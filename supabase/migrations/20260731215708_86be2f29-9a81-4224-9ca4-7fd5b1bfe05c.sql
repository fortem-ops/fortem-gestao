CREATE OR REPLACE FUNCTION public.fn_criar_contrato_tradicional(
  p_venda_id uuid,
  p_aluno_id uuid,
  p_plano_id uuid,
  p_valor_total numeric,
  p_parcelas smallint,
  p_forma_pagamento text,
  p_data_inicio date,
  p_status_pagamento text DEFAULT 'pendente',
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
  v_meio text;
  v_vigencia text;
  v_n_parcelas smallint;
  i smallint;
  v_status text;
  v_dt_pag date;
  v_data_validade date;
  v_is_corrida boolean;
  v_creditos int;
  v_valor_parcela numeric;
  v_pago boolean;
BEGIN
  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor, atividade
    INTO v_plano
  FROM public.planos_catalogo
  WHERE id = p_plano_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de catálogo % não encontrado', p_plano_id;
  END IF;

  -- Resolve o plano do aluno criado pela venda
  SELECT v.plano_id INTO v_plano_aluno_id FROM public.vendas v WHERE v.id = p_venda_id;
  IF v_plano_aluno_id IS NULL THEN
    SELECT p.id INTO v_plano_aluno_id
    FROM public.planos p
    WHERE p.aluno_id = p_aluno_id AND p.ativo = true AND p.tipo = v_plano.nome
    ORDER BY p.created_at DESC NULLS LAST, p.data_inicio DESC
    LIMIT 1;
  END IF;
  IF v_plano_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Plano ativo do aluno não encontrado para a venda %', p_venda_id;
  END IF;

  -- Idempotência: se já existe contrato ativo para este plano, não duplica
  SELECT c.id INTO v_contrato_id
  FROM public.contratos c
  WHERE c.plano_id = v_plano_aluno_id AND c.status = 'ativo'
  LIMIT 1;
  IF v_contrato_id IS NOT NULL THEN
    RETURN v_contrato_id;
  END IF;

  v_is_corrida := (v_plano.atividade = 'corrida');
  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_nome_norm := lower(btrim(COALESCE(v_plano.nome, '')));

  IF v_is_corrida THEN
    v_plano_tipo := 'corrida';
  ELSE
    v_plano_tipo := CASE
      WHEN v_nome_norm = 'start' THEN 'start'
      WHEN v_nome_norm IN ('start+', 'start plus', 'startplus') THEN 'start_plus'
      WHEN v_nome_norm = 'power' THEN 'power'
      WHEN v_nome_norm = 'pro' THEN 'pro'
      WHEN v_nome_norm IN ('max', 'vip') THEN 'max'
      WHEN v_nome_norm LIKE '%gympass%' THEN 'gympass'
      WHEN v_nome_norm LIKE '%wellhub%' THEN 'wellhub'
      WHEN v_nome_norm LIKE '%total%pass%' OR v_nome_norm = 'totalpass' THEN 'totalpass'
      ELSE 'outro'
    END;
  END IF;

  IF v_is_corrida THEN
    v_freq_sem := NULL;
    v_creditos := NULL;
  ELSE
    v_freq_sem := CASE
      WHEN v_freq_text = 'livre' THEN 5
      WHEN v_freq_text ~ '^[0-9]+x?$' THEN COALESCE(NULLIF(regexp_replace(v_freq_text,'\D','','g'),'')::smallint, 1)
      ELSE 1
    END;
    IF v_freq_sem NOT IN (1,2,3,5) THEN v_freq_sem := 1; END IF;
    v_creditos := COALESCE(v_plano.quantidade_creditos, 0);
  END IF;

  v_vigencia := CASE
    WHEN COALESCE(v_plano.periodo_meses, 1) = 12 THEN 'anual'
    WHEN COALESCE(v_plano.periodo_meses, 1) = 6 THEN 'semestral'
    ELSE 'mensal'
  END;
  v_data_validade := (p_data_inicio + (COALESCE(v_plano.periodo_meses,1) || ' months')::interval)::date;

  v_n_parcelas := GREATEST(COALESCE(p_parcelas, 1), 1);
  v_valor_parcela := ROUND(COALESCE(p_valor_total,0) / v_n_parcelas, 2);

  v_meio := CASE
    WHEN p_forma_pagamento IN ('cartao_credito','cartao_recorrencia','pix_automatico','boleto') THEN 'automatico'
    ELSE 'manual_admin'
  END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim,
    forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, cartao_token_id, criado_por, servicos_inclusos
  ) VALUES (
    p_aluno_id, v_plano_aluno_id, v_plano_tipo, v_freq_sem, v_creditos,
    v_vigencia, p_data_inicio, v_data_validade,
    p_forma_pagamento, COALESCE(p_valor_total,0), COALESCE(p_valor_total,0), 0,
    v_n_parcelas, 'ativo', NULL, auth.uid(),
    COALESCE(p_servicos_inclusos, '{}'::jsonb)
  )
  RETURNING id INTO v_contrato_id;

  IF NOT v_is_corrida THEN
    INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
    VALUES (v_contrato_id, COALESCE(v_plano.quantidade_creditos, 0), p_data_inicio,
            (p_data_inicio + INTERVAL '1 month')::date, 'ativo');
  END IF;

  v_pago := (COALESCE(p_status_pagamento, 'pendente') = 'pago');

  FOR i IN 1..v_n_parcelas LOOP
    IF v_pago THEN
      v_status := 'pago'; v_dt_pag := p_data_inicio;
    ELSE
      v_status := 'pendente'; v_dt_pag := NULL;
    END IF;

    INSERT INTO public.cobrancas (
      contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, data_pagamento,
      status, forma_pagamento, meio_registro, gateway
    ) VALUES (
      v_contrato_id, p_aluno_id, i, v_valor_parcela,
      (p_data_inicio + ((i-1) || ' months')::interval)::date, v_dt_pag,
      v_status, p_forma_pagamento, v_meio,
      CASE WHEN p_forma_pagamento IN ('cartao_credito','cartao_recorrencia') THEN 'rede'
           WHEN p_forma_pagamento = 'pix_automatico' THEN 'inter'
           ELSE NULL END
    );
  END LOOP;

  RETURN v_contrato_id;
END;
$function$;

COMMENT ON FUNCTION public.fn_criar_contrato_tradicional IS
  'Cria contrato + ciclo de crédito (exceto Corrida) + cobranças para vendas no modo Tradicional (sem recorrência automática). Idempotente por plano_id.';

REVOKE ALL ON FUNCTION public.fn_criar_contrato_tradicional(uuid,uuid,uuid,numeric,smallint,text,date,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_criar_contrato_tradicional(uuid,uuid,uuid,numeric,smallint,text,date,text,jsonb) TO authenticated, service_role;