
CREATE OR REPLACE FUNCTION public.fn_criar_contrato_recorrencia(
  p_venda_id uuid,
  p_aluno_id uuid,
  p_plano_id uuid,
  p_valor_mensal numeric,
  p_taxa_mensal numeric,
  p_data_inicio date,
  p_forma_pagamento text,
  p_cartao_token_id uuid DEFAULT NULL,
  p_primeira_paga boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor
    INTO v_plano
  FROM public.planos_catalogo
  WHERE id = p_plano_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano % não encontrado', p_plano_id;
  END IF;

  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_plano_tipo := CASE
    WHEN v_plano.ilimitado THEN 'livre'
    ELSE v_freq_text
  END;

  v_valor_total_mes := COALESCE(p_valor_mensal, 0) + COALESCE(p_taxa_mensal, 0);

  v_meio := CASE
    WHEN p_forma_pagamento IN ('cartao_credito','pix_automatico','boleto') THEN 'automatico'
    ELSE 'manual'
  END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo,
    frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim,
    forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, cartao_token_id, criado_por
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
    12, 'ativo', p_cartao_token_id, auth.uid()
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

  RETURN v_contrato_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_contrato_recorrencia(uuid,uuid,uuid,numeric,numeric,date,text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_criar_contrato_recorrencia(uuid,uuid,uuid,numeric,numeric,date,text,uuid,boolean) TO authenticated, service_role;
