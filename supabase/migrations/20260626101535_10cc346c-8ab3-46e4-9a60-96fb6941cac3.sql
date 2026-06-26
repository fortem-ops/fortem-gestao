
-- 1) Adicionar 'pendente' ao CHECK de forma_pagamento em contratos
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_forma_pagamento_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_forma_pagamento_check
  CHECK (forma_pagamento = ANY (ARRAY[
    'cartao_recorrencia','cartao_parcelado','pix_automatico','boleto',
    'maquina_debito','maquina_credito','dinheiro','pendente'
  ]));

-- 2) Coluna servicos_inclusos em contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS servicos_inclusos jsonb DEFAULT '{}'::jsonb;

-- 3) Atualizar fn_criar_contrato_recorrencia para aceitar serviços e criar créditos
CREATE OR REPLACE FUNCTION public.fn_criar_contrato_recorrencia(
  p_venda_id uuid,
  p_aluno_id uuid,
  p_plano_id uuid,
  p_valor_mensal numeric,
  p_taxa_mensal numeric,
  p_data_inicio date,
  p_forma_pagamento text,
  p_cartao_token_id uuid DEFAULT NULL,
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
  v_freq_text text;
  v_plano_tipo text;
  v_valor_total_mes numeric;
  v_meio text;
  i smallint;
  v_status text;
  v_dt_pag date;
  v_qtd_aval int;
  v_qtd_nutri int;
  v_qtd_reab int;
  v_svc_aval uuid;
  v_svc_nutri uuid;
  v_svc_reab uuid;
BEGIN
  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor
    INTO v_plano
  FROM public.planos_catalogo WHERE id = p_plano_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano % não encontrado', p_plano_id;
  END IF;

  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_plano_tipo := CASE WHEN v_plano.ilimitado THEN 'livre' ELSE v_freq_text END;
  v_valor_total_mes := COALESCE(p_valor_mensal,0) + COALESCE(p_taxa_mensal,0);
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
    p_aluno_id, p_plano_id, v_plano_tipo,
    CASE
      WHEN v_freq_text = 'livre' THEN 7
      WHEN v_freq_text ~ '^[0-9]+x?$' THEN COALESCE(NULLIF(regexp_replace(v_freq_text,'\D','','g'),'')::smallint, 1)
      ELSE 1
    END,
    COALESCE(v_plano.quantidade_creditos, 0),
    'mensal', p_data_inicio, p_data_inicio + INTERVAL '12 months',
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
      v_status := 'pago'; v_dt_pag := CURRENT_DATE;
    ELSE
      v_status := 'pendente'; v_dt_pag := NULL;
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

  -- Criar créditos de serviços
  v_qtd_aval  := COALESCE((p_servicos_inclusos->>'avaliacao_funcional')::int, 0);
  v_qtd_nutri := COALESCE((p_servicos_inclusos->>'nutricao')::int, 0);
  v_qtd_reab  := COALESCE((p_servicos_inclusos->>'reabilitacao')::int, 0);

  IF v_qtd_aval > 0 THEN
    SELECT id INTO v_svc_aval FROM public.servicos_catalogo
      WHERE ativo = true AND atividade ILIKE 'Avaliação Funcional' LIMIT 1;
    IF v_svc_aval IS NOT NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, servico_id, quantidade, origem, contrato_id)
      VALUES (p_aluno_id, v_svc_aval, v_qtd_aval, 'plano', v_contrato_id);
    END IF;
  END IF;

  IF v_qtd_nutri > 0 THEN
    SELECT id INTO v_svc_nutri FROM public.servicos_catalogo
      WHERE ativo = true AND atividade ILIKE 'Nutrição' LIMIT 1;
    IF v_svc_nutri IS NOT NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, servico_id, quantidade, origem, contrato_id)
      VALUES (p_aluno_id, v_svc_nutri, v_qtd_nutri, 'plano', v_contrato_id);
    END IF;
  END IF;

  IF v_qtd_reab > 0 THEN
    SELECT id INTO v_svc_reab FROM public.servicos_catalogo
      WHERE ativo = true AND atividade ILIKE 'Reabilitação' LIMIT 1;
    IF v_svc_reab IS NOT NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, servico_id, quantidade, origem, contrato_id)
      VALUES (p_aluno_id, v_svc_reab, v_qtd_reab, 'plano', v_contrato_id);
    END IF;
  END IF;

  RETURN v_contrato_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_criar_contrato_recorrencia(uuid, uuid, uuid, numeric, numeric, date, text, uuid, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_criar_contrato_recorrencia(uuid, uuid, uuid, numeric, numeric, date, text, uuid, boolean, jsonb) TO authenticated, service_role;
