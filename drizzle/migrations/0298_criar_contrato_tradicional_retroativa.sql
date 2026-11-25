CREATE OR REPLACE FUNCTION public.fn_criar_contrato_tradicional_retroativa(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_venda_id uuid := (p->>'venda_id')::uuid;
  v_aluno_id uuid := (p->>'aluno_id')::uuid;
  v_plano_id uuid := (p->>'plano_id')::uuid;
  v_data_inicio date := (p->>'data_inicio')::date;
  v_data_venda date := NULLIF(trim(COALESCE(p->>'data_venda', '')), '')::date;
  v_forma_pagamento text := COALESCE(NULLIF(trim(COALESCE(p->>'forma_pagamento', '')), ''), 'dinheiro');
  v_n_parcelas smallint := GREATEST(COALESCE((p->>'parcelas')::smallint, 1), 1);
  v_servicos_inclusos jsonb := COALESCE(p->'servicos_inclusos', '{}'::jsonb);
  v_desc_c bigint := round(COALESCE((p->>'desconto')::numeric, 0) * 100);
  v_override_raw text := NULLIF(trim(COALESCE(p->>'valor_plano_override', '')), '');
  v_override_c bigint;
  v_motivo text := NULLIF(trim(COALESCE(p->>'motivo', '')), '');
  v_ja_pago boolean := COALESCE((p->>'ja_pago')::boolean, false);
  v_forma_rec text := NULLIF(trim(COALESCE(p->>'forma_recebimento', '')), '');
  v_bandeira text := NULLIF(trim(COALESCE(p->>'bandeira', '')), '');
  v_parc_cartao smallint := NULLIF(trim(COALESCE(p->>'parcelas_cartao', '')), '')::smallint;
  v_data_pagamento date := NULLIF(trim(COALESCE(p->>'data_pagamento', '')), '')::date;
  v_gateway text;
  v_venda_forma text;
  v_plano record;
  v_plano_aluno_id uuid;
  v_contratos_antigos uuid[];
  v_is_corrida boolean;
  v_freq_text text;
  v_nome_norm text;
  v_plano_tipo text;
  v_freq_sem smallint;
  v_creditos int;
  v_vigencia text;
  v_data_validade date;
  v_meio text;
  v_cat_c bigint;
  v_total_c bigint;
  v_base_c bigint;
  v_contrato_id uuid;
  v_cobranca_forma text;
  v_cobranca_gateway text;
  v_cobranca_meio text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar venda retroativa ou com valor ajustado';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da venda retroativa ou do ajuste de valor';
  END IF;

  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor, atividade
    INTO v_plano
  FROM public.planos_catalogo
  WHERE id = v_plano_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de catálogo % não encontrado', v_plano_id;
  END IF;

  v_cat_c := round(COALESCE(v_plano.valor, 0) * 100);

  IF v_override_raw IS NOT NULL THEN
    v_override_c := round(v_override_raw::numeric * 100);
    IF v_override_c <= 0 THEN
      RAISE EXCEPTION 'Valor cobrado inválido';
    END IF;
    IF v_desc_c > 0 THEN
      RAISE EXCEPTION 'Não é possível combinar valor cobrado manual com desconto';
    END IF;
    IF v_override_c < v_cat_c THEN
      RAISE EXCEPTION 'Valor cobrado não pode ser menor que o catálogo (use desconto)';
    END IF;
    v_total_c := v_override_c;
  ELSE
    IF v_desc_c < 0 THEN
      RAISE EXCEPTION 'Desconto inválido';
    END IF;
    v_total_c := GREATEST(0, v_cat_c - v_desc_c);
  END IF;

  IF v_ja_pago THEN
    IF v_forma_rec IS NULL OR v_forma_rec NOT IN ('dinheiro', 'pix', 'maquina_debito', 'maquina_credito', 'boleto') THEN
      RAISE EXCEPTION 'Forma de recebimento inválida para venda já paga';
    END IF;
    IF v_forma_rec IN ('maquina_debito', 'maquina_credito') AND v_bandeira IS NULL THEN
      RAISE EXCEPTION 'Selecione a bandeira do cartão';
    END IF;
    IF v_forma_rec = 'maquina_credito' THEN
      v_parc_cartao := COALESCE(v_parc_cartao, 1);
      IF v_parc_cartao < 1 OR v_parc_cartao > 12 THEN
        RAISE EXCEPTION 'Informe um número de parcelas entre 1 e 12';
      END IF;
    ELSE
      v_parc_cartao := NULL;
    END IF;
    IF v_forma_rec NOT IN ('maquina_debito', 'maquina_credito') THEN
      v_bandeira := NULL;
    END IF;
    v_data_pagamento := COALESCE(v_data_pagamento, v_data_venda, v_data_inicio, CURRENT_DATE);
    v_gateway := CASE v_forma_rec
      WHEN 'dinheiro' THEN 'dinheiro'
      WHEN 'pix' THEN 'inter_pix'
      WHEN 'maquina_debito' THEN 'maquina'
      WHEN 'maquina_credito' THEN 'maquina'
      WHEN 'boleto' THEN 'boleto'
    END;
    v_venda_forma := CASE v_forma_rec
      WHEN 'dinheiro' THEN 'dinheiro'
      WHEN 'pix' THEN 'pix'
      WHEN 'maquina_debito' THEN 'cartao_debito'
      WHEN 'maquina_credito' THEN 'cartao_credito'
      WHEN 'boleto' THEN 'boleto'
    END;
  END IF;

  SELECT v.plano_id INTO v_plano_aluno_id FROM public.vendas v WHERE v.id = v_venda_id;
  IF v_plano_aluno_id IS NULL THEN
    SELECT pl.id INTO v_plano_aluno_id
    FROM public.planos pl
    WHERE pl.aluno_id = v_aluno_id AND pl.ativo = true AND pl.tipo = v_plano.nome
    ORDER BY pl.created_at DESC NULLS LAST, pl.data_inicio DESC
    LIMIT 1;
  END IF;
  IF v_plano_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Plano ativo do aluno não encontrado para a venda %', v_venda_id;
  END IF;

  SELECT array_agg(id) INTO v_contratos_antigos
  FROM public.contratos WHERE plano_id = v_plano_aluno_id;

  IF v_contratos_antigos IS NOT NULL AND array_length(v_contratos_antigos, 1) > 0 THEN
    DELETE FROM public.contratos_documentos WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.inadimplencias WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.ciclos_credito WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.cobrancas WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.contratos WHERE id = ANY(v_contratos_antigos);
  END IF;

  v_is_corrida := (v_plano.atividade = 'corrida');
  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_nome_norm := lower(btrim(COALESCE(v_plano.nome, '')));

  IF v_is_corrida THEN
    v_plano_tipo := 'corrida';
    v_freq_sem := NULL;
    v_creditos := NULL;
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
    v_freq_sem := CASE
      WHEN v_freq_text = 'livre' THEN 5
      WHEN v_freq_text ~ '^[0-9]+x?$' THEN COALESCE(NULLIF(regexp_replace(v_freq_text, '\D', '', 'g'), '')::smallint, 1)
      ELSE 1
    END;
    IF v_freq_sem NOT IN (1, 2, 3, 5) THEN v_freq_sem := 1; END IF;
    v_creditos := COALESCE(v_plano.quantidade_creditos, 0);
  END IF;

  v_vigencia := CASE
    WHEN COALESCE(v_plano.periodo_meses, 1) = 12 THEN 'anual'
    WHEN COALESCE(v_plano.periodo_meses, 1) = 6 THEN 'semestral'
    ELSE 'mensal'
  END;
  v_data_validade := (v_data_inicio + (COALESCE(v_plano.periodo_meses, 1) || ' months')::interval)::date;

  v_meio := CASE
    WHEN v_forma_pagamento IN ('cartao_credito', 'cartao_recorrencia', 'pix_automatico', 'boleto') THEN 'automatico'
    ELSE 'manual_admin'
  END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim,
    forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, cartao_token_id, criado_por, servicos_inclusos
  ) VALUES (
    v_aluno_id, v_plano_aluno_id, v_plano_tipo, v_freq_sem, v_creditos,
    v_vigencia, v_data_inicio, v_data_validade,
    v_forma_pagamento, v_total_c / 100.0, v_total_c / 100.0, 0,
    v_n_parcelas, 'ativo', NULL, v_uid,
    v_servicos_inclusos
  )
  RETURNING id INTO v_contrato_id;

  IF NOT v_is_corrida THEN
    INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
    VALUES (
      v_contrato_id,
      COALESCE(v_plano.quantidade_creditos, 0),
      v_data_inicio,
      (v_data_inicio + INTERVAL '1 month')::date,
      'ativo'
    );
  END IF;

  v_base_c := v_total_c / v_n_parcelas;
  v_cobranca_forma := CASE WHEN v_ja_pago THEN v_forma_rec ELSE v_forma_pagamento END;
  v_cobranca_meio := CASE WHEN v_ja_pago THEN 'manual_admin' ELSE v_meio END;
  v_cobranca_gateway := CASE
    WHEN v_ja_pago THEN v_gateway
    WHEN v_forma_pagamento IN ('cartao_credito', 'cartao_recorrencia') THEN 'rede'
    WHEN v_forma_pagamento = 'pix_automatico' THEN 'inter'
    ELSE NULL
  END;

  -- Comando único (sem laço) para não disparar o gatilho de receitas N vezes
  INSERT INTO public.cobrancas (
    contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, data_pagamento,
    status, forma_pagamento, meio_registro, gateway, bandeira, parcelas_cartao
  )
  SELECT
    v_contrato_id,
    v_aluno_id,
    gs.i::smallint,
    (CASE WHEN gs.i = v_n_parcelas THEN v_total_c - v_base_c * (v_n_parcelas - 1) ELSE v_base_c END) / 100.0,
    (v_data_inicio + ((gs.i - 1) || ' months')::interval)::date,
    CASE WHEN v_ja_pago THEN v_data_pagamento ELSE NULL END,
    CASE WHEN v_ja_pago THEN 'pago' ELSE 'pendente' END,
    v_cobranca_forma,
    v_cobranca_meio,
    v_cobranca_gateway,
    CASE WHEN v_ja_pago THEN v_bandeira ELSE NULL END,
    CASE WHEN v_ja_pago THEN v_parc_cartao ELSE NULL END
  FROM generate_series(1, v_n_parcelas) AS gs(i);

  UPDATE public.vendas
  SET valor = CASE WHEN v_override_c IS NOT NULL THEN v_override_c / 100.0 ELSE valor END,
      valor_final = v_total_c / 100.0,
      data_venda = COALESCE(v_data_venda, data_venda),
      status_pagamento = CASE WHEN v_ja_pago THEN 'pago' ELSE status_pagamento END,
      forma_pagamento = CASE WHEN v_ja_pago THEN v_venda_forma ELSE forma_pagamento END
  WHERE id = v_venda_id;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES (
    'vendas',
    v_venda_id,
    'venda_retroativa',
    v_uid,
    jsonb_build_object('valor_catalogo', v_cat_c / 100.0),
    jsonb_build_object(
      'motivo', v_motivo,
      'valor_cobrado', v_total_c / 100.0,
      'data_venda', v_data_venda,
      'ja_pago', v_ja_pago,
      'forma_recebimento', v_forma_rec,
      'bandeira', v_bandeira,
      'parcelas_cartao', v_parc_cartao,
      'data_pagamento', v_data_pagamento
    )
  );

  RETURN v_contrato_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_criar_contrato_tradicional_retroativa(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_criar_contrato_tradicional_retroativa(jsonb) TO authenticated, service_role;