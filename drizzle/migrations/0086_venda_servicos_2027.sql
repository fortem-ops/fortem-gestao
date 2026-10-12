CREATE OR REPLACE FUNCTION public.fn_venda_servicos_2027_criar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_forma_s text := COALESCE(p->>'forma_servicos', 'pix_vista');
  v_n_s int := COALESCE((p->>'parcelas_servicos')::int, 1);
  v_ini date := COALESCE((p->>'data_inicio')::date, CURRENT_DATE);
  v_idem text := NULLIF(p->>'idempotency_key', '');
  v_teste boolean;
  v_origem text;
  s record;
  v_sid uuid; v_comp jsonb; v_cred uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Somente administradores podem vender serviços 2027';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  IF jsonb_array_length(COALESCE(p->'servicos', '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um serviço'; END IF;
  IF v_idem IS NOT NULL AND EXISTS (SELECT 1 FROM public.vendas WHERE idempotency_key LIKE v_idem || ':s%') THEN
    RETURN jsonb_build_object('repetida', true);
  END IF;
  IF v_forma_s NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF v_forma_s = 'pix_vista' THEN v_n_s := 1; END IF;
  IF v_n_s < 1 OR v_n_s > 6 THEN RAISE EXCEPTION 'Parcelas dos serviços devem ser entre 1 e 6'; END IF;

  v_teste := EXISTS (SELECT 1 FROM public.sistema_config sc WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
                     AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? v_aluno::text);
  v_origem := CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END;

  FOR s IN
    SELECT sc.*, x.ord FROM jsonb_array_elements_text(p->'servicos') WITH ORDINALITY x(id, ord)
    LEFT JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid AND sc.versao = 2027 ORDER BY x.ord
  LOOP
    IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço 2027 não encontrado'; END IF;
    IF NOT v_teste AND NOT (s.ativo AND (s.vendavel_desde IS NULL OR s.vendavel_desde <= CURRENT_DATE)
                            AND (s.vendavel_ate IS NULL OR s.vendavel_ate >= CURRENT_DATE)) THEN
      RAISE EXCEPTION 'Serviço 2027 ainda não liberado para venda';
    END IF;
    INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
      forma_pagamento, parcelas, vendedor_id, status_pagamento, data_venda, tipo_cobranca,
      modalidade_pagamento, canal_pagamento, origem, idempotency_key, observacoes)
    VALUES (v_aluno, 'servico', s.id, s.nome, s.valor, 0, s.valor,
      CASE WHEN v_forma_s = 'pix_vista' THEN 'pix' ELSE 'cartao_credito' END, v_n_s, v_uid, 'pendente', v_ini,
      'tradicional', v_forma_s, 'manual', v_origem,
      CASE WHEN v_idem IS NOT NULL THEN v_idem || ':s' || s.ord END,
      NULLIF(btrim(COALESCE(p->>'observacoes', '')), ''))
    RETURNING id INTO v_sid;
    v_ids := v_ids || v_sid;
    FOR v_comp IN SELECT * FROM jsonb_array_elements(COALESCE(s.composicao, jsonb_build_array(jsonb_build_object('atividade', s.atividade, 'quantidade', s.quantidade_sessoes))))
    LOOP
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
      VALUES (v_aluno, 'servico', v_sid, v_comp->>'atividade', (v_comp->>'quantidade')::int, false,
              (v_ini + make_interval(months => COALESCE(s.validade_meses, 12)))::date)
      RETURNING id INTO v_cred;
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
      VALUES (v_cred, 'compra', (v_comp->>'quantidade')::int, v_uid, 'Serviço 2027: ' || s.nome);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('servico_venda_ids', to_jsonb(v_ids), 'teste', v_teste);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_venda_servicos_2027_criar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_servicos_2027_criar(jsonb) TO authenticated;