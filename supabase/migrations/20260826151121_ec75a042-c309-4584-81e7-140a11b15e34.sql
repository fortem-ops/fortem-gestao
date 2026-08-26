-- Tabela de preços por tipo de serviço para efeito de rescisão.
-- TODO: definir valores dos demais tipos (Avaliação Funcional, consultorias,
-- reposições etc.) — atualmente R$ 0,00.
CREATE OR REPLACE FUNCTION public.fn_preco_servico_rescisao(p_tipo_servico text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN unaccent_lower IS NULL THEN 0
    -- Nutrição: qualquer variação "nutri..."
    WHEN unaccent_lower ~ 'nutri' THEN 300.00
    -- Fisioterapia / reabilitação
    WHEN unaccent_lower ~ '(fisio|reabilit)' THEN 150.00
    -- TODO: definir valor - atualmente R$0 para os tipos não mapeados
    ELSE 0
  END
  FROM (
    SELECT lower(translate(COALESCE(p_tipo_servico,''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS unaccent_lower
  ) s;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_preco_servico_rescisao(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_preco_servico_rescisao(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_calcular_rescisao(
  p_contrato_id uuid,
  p_data_cancelamento date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v              public.contratos%ROWTYPE;
  v_data_cancel  date;
  v_mes_atual    int;
  v_meses_rest   int;
  v_perc_multa   numeric;
  v_perc_restit  numeric;
  v_vincendo     numeric;
  v_multa        numeric;
  v_restit_bruto numeric;
  v_servicos     numeric := 0;
  v_detalhe      jsonb   := '[]'::jsonb;
BEGIN
  IF NOT (public.is_admin_role() OR public.is_coordenador_ou_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  v_data_cancel := COALESCE(p_data_cancelamento, CURRENT_DATE);

  -- Serviços já utilizados pelo aluno dentro da vigência do contrato,
  -- até a data efetiva de cancelamento. Não depende de contrato_id
  -- (hoje frequentemente NULL nesses registros).
  SELECT
    COALESCE(SUM(cs.quantidade * public.fn_preco_servico_rescisao(cs.tipo_servico)), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', cs.id,
      'tipo_servico', cs.tipo_servico,
      'data_consumo', cs.data_consumo,
      'quantidade', cs.quantidade,
      'valor_unitario_aplicado', public.fn_preco_servico_rescisao(cs.tipo_servico),
      'valor_total', cs.quantidade * public.fn_preco_servico_rescisao(cs.tipo_servico)
    ) ORDER BY cs.data_consumo), '[]'::jsonb)
  INTO v_servicos, v_detalhe
  FROM public.consumo_servicos cs
  WHERE cs.aluno_id = v.aluno_id
    AND (cs.contrato_id IS NULL OR cs.contrato_id = p_contrato_id)
    AND cs.data_consumo >= v.data_inicio
    AND cs.data_consumo <= v_data_cancel
    AND (v.data_fim IS NULL OR cs.data_consumo <= v.data_fim);

  IF v.vigencia_tipo = 'mensal' THEN
    RETURN jsonb_build_object(
      'tipo','start_sem_multa','plano_tipo',v.plano_tipo,
      'data_inicio',v.data_inicio,'total_devido',0,'total_restituir',0,
      'valor_servicos_utilizados',0,
      'servicos_utilizados_detalhe',v_detalhe,
      'descricao','Plano mensal sem fidelidade. Sem multa de cancelamento. '
               || 'Acesso mantido até o fim do ciclo já pago. '
               || 'Cobranças futuras interrompidas imediatamente.'
    );
  END IF;

  v_mes_atual := GREATEST(1, LEAST(12,
    EXTRACT(YEAR  FROM age(v_data_cancel, v.data_inicio))::int * 12 +
    EXTRACT(MONTH FROM age(v_data_cancel, v.data_inicio))::int + 1
  ));
  v_meses_rest := 12 - v_mes_atual;

  v_perc_multa  := CASE WHEN v_mes_atual <= 4 THEN 0.25 WHEN v_mes_atual <= 6 THEN 0.20 ELSE 0.15 END;
  v_perc_restit := CASE WHEN v_mes_atual <= 4 THEN 0.75 WHEN v_mes_atual <= 6 THEN 0.80 ELSE 0.85 END;

  IF v.forma_pagamento = 'cartao_recorrencia' OR v.forma_pagamento = 'pix_automatico' THEN
    v_vincendo := GREATEST(0, v_meses_rest) * v.valor_cobrado;
    v_multa    := ROUND(v_vincendo * v_perc_multa + v_servicos, 2);

    RETURN jsonb_build_object(
      'tipo','recorrencia_com_multa','plano_tipo',v.plano_tipo,
      'data_inicio',v.data_inicio,'data_fim',v.data_fim,
      'data_cancelamento',v_data_cancel,
      'mes_atual',v_mes_atual,'meses_restantes',v_meses_rest,
      'valor_mensalidade',v.valor_cobrado,'taxa_recorrencia',v.taxa_recorrencia,
      'valor_vincendo',ROUND(v_vincendo,2),
      'percentual_multa',(v_perc_multa*100)::int,
      'multa_base',ROUND(v_vincendo * v_perc_multa,2),
      'valor_servicos_utilizados',ROUND(v_servicos,2),
      'servicos_utilizados_detalhe',v_detalhe,
      'total_devido',v_multa,'total_restituir',0,
      'descricao',format(
        'Rescisão no %sº mês. Multa de %s%% sobre %s mensalidades vincendas (R$ %s) = R$ %s. '
        || 'Serviços já utilizados: R$ %s. Total: R$ %s.',
        v_mes_atual,(v_perc_multa*100)::int,v_meses_rest,
        ROUND(v_vincendo,2), ROUND(v_vincendo * v_perc_multa,2),
        ROUND(v_servicos,2), v_multa)
    );
  END IF;

  v_restit_bruto := ROUND(((v_meses_rest::numeric/12.0) * v.valor_cobrado * v.parcelas) * v_perc_restit, 2);

  RETURN jsonb_build_object(
    'tipo','parcelado_com_restituicao','plano_tipo',v.plano_tipo,
    'data_inicio',v.data_inicio,'data_fim',v.data_fim,
    'data_cancelamento',v_data_cancel,
    'mes_atual',v_mes_atual,'meses_restantes',v_meses_rest,
    'valor_total_contrato',ROUND(v.valor_cobrado * v.parcelas,2),
    'valor_proporcional',ROUND((v_meses_rest::numeric/12.0) * v.valor_cobrado * v.parcelas,2),
    'percentual_restituicao',(v_perc_restit*100)::int,
    'restituicao_bruta',v_restit_bruto,
    'valor_servicos_utilizados',ROUND(v_servicos,2),
    'servicos_utilizados_detalhe',v_detalhe,
    'deducao_servicos',ROUND(v_servicos,2),
    'total_restituir',ROUND(GREATEST(v_restit_bruto - v_servicos,0),2),
    'saldo_devedor',ROUND(GREATEST(v_servicos - v_restit_bruto,0),2),
    'total_devido',ROUND(GREATEST(v_servicos - v_restit_bruto,0),2),
    'descricao',format(
      'Rescisão no %sº mês. Restituição de %s%% do proporcional restante (R$ %s). '
      || 'Dedução serviços utilizados: R$ %s. '
      || CASE WHEN v_restit_bruto >= v_servicos
         THEN 'Valor a restituir ao aluno: R$ %s.'
         ELSE 'Saldo devedor do aluno: R$ %s.' END,
      v_mes_atual,(v_perc_restit*100)::int,v_restit_bruto,
      ROUND(v_servicos,2),ROUND(ABS(v_restit_bruto - v_servicos),2))
  );
END; $function$;
