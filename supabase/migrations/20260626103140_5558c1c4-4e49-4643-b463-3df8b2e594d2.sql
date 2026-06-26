CREATE OR REPLACE FUNCTION public.fn_criar_contrato_recorrencia(
  p_venda_id uuid,
  p_aluno_id uuid,
  p_plano_id uuid,
  p_valor_mensal numeric,
  p_taxa_mensal numeric,
  p_data_inicio date,
  p_forma_pagamento text,
  p_cartao_token_id uuid DEFAULT NULL::uuid,
  p_primeira_paga boolean DEFAULT false,
  p_servicos_inclusos jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato_id uuid;
  v_plano record;
  v_plano_aluno_id uuid;
  v_freq_text text;
  v_plano_tipo text;
  v_freq_sem smallint;
  v_nome_norm text;
  v_valor_total_mes numeric;
  v_meio text;
  i smallint;
  v_status text;
  v_dt_pag date;
  v_qtd_aval int;
  v_qtd_nutri int;
  v_qtd_reab int;
  v_data_validade date;
BEGIN
  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor
    INTO v_plano
  FROM public.planos_catalogo
  WHERE id = p_plano_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de catálogo % não encontrado', p_plano_id;
  END IF;

  SELECT v.plano_id
    INTO v_plano_aluno_id
  FROM public.vendas v
  WHERE v.id = p_venda_id;

  IF v_plano_aluno_id IS NULL THEN
    SELECT p.id
      INTO v_plano_aluno_id
    FROM public.planos p
    WHERE p.aluno_id = p_aluno_id
      AND p.ativo = true
      AND p.tipo = v_plano.nome
    ORDER BY p.created_at DESC NULLS LAST, p.data_inicio DESC
    LIMIT 1;
  END IF;

  IF v_plano_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Plano ativo do aluno não encontrado para a venda %', p_venda_id;
  END IF;

  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_nome_norm := lower(btrim(COALESCE(v_plano.nome, '')));

  v_plano_tipo := CASE
    WHEN v_nome_norm = 'start' THEN 'start'
    WHEN v_nome_norm IN ('start+', 'start plus', 'startplus') THEN 'start_plus'
    WHEN v_nome_norm = 'power' THEN 'power'
    WHEN v_nome_norm = 'pro' THEN 'pro'
    WHEN v_nome_norm IN ('max', 'vip') THEN 'max'
    WHEN v_nome_norm LIKE '%corrida%' THEN 'corrida'
    WHEN v_nome_norm LIKE '%gympass%' THEN 'gympass'
    WHEN v_nome_norm LIKE '%wellhub%' THEN 'wellhub'
    WHEN v_nome_norm LIKE '%total%pass%' OR v_nome_norm = 'totalpass' THEN 'totalpass'
    ELSE 'outro'
  END;

  v_freq_sem := CASE
    WHEN v_freq_text = 'livre' THEN 5
    WHEN v_freq_text ~ '^[0-9]+x?$' THEN COALESCE(NULLIF(regexp_replace(v_freq_text,'\D','','g'),'')::smallint, 1)
    ELSE 1
  END;
  IF v_freq_sem NOT IN (1,2,3,5) THEN
    v_freq_sem := 1;
  END IF;

  v_valor_total_mes := COALESCE(p_valor_mensal,0) + COALESCE(p_taxa_mensal,0);
  v_data_validade := (p_data_inicio + INTERVAL '12 months')::date;
  v_meio := CASE
    WHEN p_forma_pagamento IN ('cartao_credito','cartao_recorrencia','pix_automatico','boleto') THEN 'automatico'
    ELSE 'manual'
  END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo,
    frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim,
    forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, cartao_token_id, criado_por, servicos_inclusos
  ) VALUES (
    p_aluno_id, v_plano_aluno_id, v_plano_tipo,
    v_freq_sem,
    COALESCE(v_plano.quantidade_creditos, 0),
    'mensal', p_data_inicio, v_data_validade,
    p_forma_pagamento,
    COALESCE(p_valor_mensal,0),
    v_valor_total_mes,
    COALESCE(p_taxa_mensal,0),
    12, 'ativo', p_cartao_token_id, auth.uid(),
    COALESCE(p_servicos_inclusos, '{}'::jsonb)
  )
  RETURNING id INTO v_contrato_id;

  FOR i IN 1..12 LOOP
    IF i = 1 AND p_primeira_paga THEN
      v_status := 'pago';
      v_dt_pag := CURRENT_DATE;
    ELSE
      v_status := 'pendente';
      v_dt_pag := NULL;
    END IF;

    INSERT INTO public.cobrancas (
      contrato_id, aluno_id, numero_ciclo, valor,
      data_vencimento, data_pagamento, status,
      forma_pagamento, meio_registro, registrado_por
    ) VALUES (
      v_contrato_id, p_aluno_id, i, v_valor_total_mes,
      p_data_inicio + ((i - 1) || ' months')::interval,
      v_dt_pag, v_status,
      p_forma_pagamento, v_meio, auth.uid()
    );
  END LOOP;

  v_qtd_aval := COALESCE((p_servicos_inclusos->>'avaliacao_funcional')::int, 0);
  v_qtd_nutri := COALESCE((p_servicos_inclusos->>'consultas_nutricao')::int, 0);
  v_qtd_reab := COALESCE((p_servicos_inclusos->>'consultas_reabilitacao')::int, 0);

  IF v_qtd_aval > 0 THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
    VALUES (p_aluno_id, 'plano', v_contrato_id, 'Avaliação Funcional', v_qtd_aval, false, v_data_validade);
  END IF;
  IF v_qtd_nutri > 0 THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
    VALUES (p_aluno_id, 'plano', v_contrato_id, 'Nutrição', v_qtd_nutri, false, v_data_validade);
  END IF;
  IF v_qtd_reab > 0 THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
    VALUES (p_aluno_id, 'plano', v_contrato_id, 'Reabilitação', v_qtd_reab, false, v_data_validade);
  END IF;

  RETURN v_contrato_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_criar_contrato_recorrencia(uuid, uuid, uuid, numeric, numeric, date, text, uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_criar_contrato_recorrencia(uuid, uuid, uuid, numeric, numeric, date, text, uuid, boolean, jsonb) TO authenticated, service_role;