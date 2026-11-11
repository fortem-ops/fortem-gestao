-- Teste real de R$ 1,00 do Plano Semestral: só vale com a chave sistema_config 'semestral_teste_real'
-- (aluno_id, codigo, valor_centavos, valido_ate). Sem a chave, nada muda para ninguém.
CREATE OR REPLACE FUNCTION public.fn_semestral_teste_real(p_aluno uuid, p_codigo text)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT (sc.valor->>'valor_centavos')::int FROM public.sistema_config sc
   WHERE sc.chave = 'semestral_teste_real' AND jsonb_typeof(sc.valor) = 'object'
     AND sc.valor->>'aluno_id' = p_aluno::text AND sc.valor->>'codigo' = p_codigo
     AND now() <= (sc.valor->>'valido_ate')::timestamptz
     AND (sc.valor->>'valor_centavos')::int > 0
     AND EXISTS (SELECT 1 FROM public.sistema_config t WHERE t.chave = 'vendas_2027_teste_aluno_ids'
                  AND jsonb_typeof(t.valor) = 'array' AND t.valor ? p_aluno::text);
$function$;
REVOKE ALL ON FUNCTION public.fn_semestral_teste_real(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_teste_real(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_semestral_elegivel(p_aluno uuid, p_codigo text, p_hoje date DEFAULT NULL::date, p_ignorar_cpf boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.planos_catalogo;
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_well boolean; v_total boolean; v_agr text; v_hash text; v_usado boolean; v_teste boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE codigo = p_codigo;
  IF NOT FOUND OR c.agregadora_requerida IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Item não é do Plano Semestral de agregadora.');
  END IF;
  v_teste := public.fn_semestral_teste_real(p_aluno, p_codigo) IS NOT NULL;
  IF v_teste THEN
    v_agr := c.agregadora_requerida;  -- teste real autorizado: dispensa só a exigência de agregadora
  ELSE
    SELECT bool_or(tipo = 'Gympass/Wellhub'), bool_or(tipo = 'Total Pass') INTO v_well, v_total
    FROM public.planos WHERE aluno_id = p_aluno AND ativo;
    v_well := COALESCE(v_well, false); v_total := COALESCE(v_total, false);
    IF v_well AND v_total THEN
      RETURN jsonb_build_object('elegivel', false, 'motivo', 'Aluno com Wellhub e TotalPass ativos ao mesmo tempo: a equipe precisa corrigir o cadastro.');
    END IF;
    v_agr := CASE WHEN v_well THEN 'wellhub' WHEN v_total THEN 'totalpass' END;
    IF v_agr IS NULL THEN
      RETURN jsonb_build_object('elegivel', false, 'motivo', 'Aluno sem plano de agregadora ativo.');
    END IF;
    IF v_agr <> c.agregadora_requerida THEN
      RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Este item é de outra agregadora.');
    END IF;
  END IF;
  IF c.vendavel_ate IS NOT NULL AND v_hoje > c.vendavel_ate THEN
    RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Promoção encerrada em ' || to_char(c.vendavel_ate, 'DD/MM/YYYY') || '.');
  END IF;
  IF NOT p_ignorar_cpf THEN
    SELECT cpf_hash INTO v_hash FROM public.alunos WHERE id = p_aluno;
    SELECT EXISTS (
      SELECT 1 FROM public.vendas v
       WHERE v.aluno_id IN (SELECT id FROM public.alunos WHERE id = p_aluno OR (v_hash IS NOT NULL AND cpf_hash = v_hash))
         AND v.catalogo_id IN (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027')
         AND public.fn_semestral_venda_paga(v.id)
    ) INTO v_usado;
    IF v_usado THEN
      RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Este CPF já contratou o Plano Semestral (inclusive cancelado) e não pode recontratar.');
    END IF;
  END IF;
  RETURN jsonb_build_object('elegivel', true, 'agregadora', v_agr, 'motivo', null, 'teste_real', v_teste);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_semestral_itens_elegiveis(p_aluno uuid, p_hoje date DEFAULT NULL::date)
 RETURNS SETOF planos_catalogo LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.* FROM public.planos_catalogo c
  WHERE c.agregadora_requerida IS NOT NULL
    AND (COALESCE(c.ativo, false) OR public.fn_semestral_teste_real(p_aluno, c.codigo) IS NOT NULL)
    AND (public.fn_semestral_elegivel(p_aluno, c.codigo, p_hoje) ->> 'elegivel')::boolean
  ORDER BY c.valor;
$function$;

CREATE OR REPLACE FUNCTION public.fn_venda_semestral_criar(p jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  c public.planos_catalogo; e jsonb; r jsonb; v_teste boolean; pend record; v_real int;
BEGIN
  IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, 'coordenador'::app_role) OR public.has_role(v_uid, 'professor'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para vender o Plano Semestral';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid AND familia = 'semestral_2027';
  IF NOT FOUND OR c.agregadora_requerida IS NULL THEN RAISE EXCEPTION 'Item do Plano Semestral não encontrado'; END IF;
  v_real := public.fn_semestral_teste_real(v_aluno, c.codigo);
  IF NOT COALESCE(c.ativo, false) AND v_real IS NULL THEN RAISE EXCEPTION 'Item do Plano Semestral desligado'; END IF;

  SELECT v.id AS venda_id, v.catalogo_id, k.id AS contrato_id, v.plano_id, cb.id AS cobranca_id, cb.valor
    INTO pend
    FROM public.vendas v
    JOIN public.planos pl ON pl.id = v.plano_id AND NOT pl.ativo
    JOIN public.contratos k ON k.plano_id = v.plano_id AND k.plano_tipo = 'semestral_2027' AND k.status = 'ativo'
    JOIN public.cobrancas cb ON cb.contrato_id = k.id AND cb.numero_ciclo = 1 AND cb.status IN ('pendente','atrasado')
   WHERE v.aluno_id = v_aluno AND v.status_pagamento NOT IN ('pago','cancelado','estornado')
     AND v.catalogo_id IN (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027')
   ORDER BY v.created_at DESC LIMIT 1;
  IF pend.venda_id IS NOT NULL THEN
    IF pend.catalogo_id <> c.id THEN
      RAISE EXCEPTION 'Já existe uma venda do Plano Semestral aguardando o pagamento da 1ª mensalidade (outro item). Conclua o pagamento dela.';
    END IF;
    RETURN jsonb_build_object('venda_id', pend.venda_id, 'contrato_id', pend.contrato_id, 'plano_id', pend.plano_id,
      'cobranca_id', pend.cobranca_id, 'valor_centavos', round(pend.valor * 100)::int, 'retomada', true, 'repetida', true,
      'agregadora', c.agregadora_requerida, 'contrato_modelo', 'semestral_' || c.agregadora_requerida);
  END IF;

  e := public.fn_semestral_elegivel(v_aluno, c.codigo, v_hoje);
  IF NOT (e->>'elegivel')::boolean THEN RAISE EXCEPTION 'Plano Semestral não permitido: %', e->>'motivo'; END IF;
  v_teste := EXISTS (SELECT 1 FROM public.sistema_config sc WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
                     AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? v_aluno::text);
  r := public.fn_venda_2027_gravar(jsonb_build_object(
      'aluno_id', v_aluno, 'catalogo_id', c.id, 'forma', 'recorrencia', 'parcelas', 1,
      'servicos', '[]'::jsonb, 'data_inicio', v_hoje, 'primeiro_vencimento', v_hoje,
      'substituir', false, 'observacoes', p->>'observacoes', 'idempotency_key', p->>'idempotency_key'),
    v_uid, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END, 'manual', false);
  IF COALESCE((r->>'repetida')::boolean, false) THEN RETURN r; END IF;

  UPDATE public.planos SET ativo = false WHERE id = (r->>'plano_id')::uuid;
  UPDATE public.creditos_aluno SET ativo = false
   WHERE aluno_id = v_aluno AND origem_id IN ((r->>'venda_id')::uuid, (r->>'plano_id')::uuid) AND ativo;

  -- Teste real autorizado: preço do teste na venda, contrato e 1ª mensalidade (a cobrança acompanha pelo espelho).
  IF v_real IS NOT NULL THEN
    UPDATE public.vendas SET valor = v_real / 100.0, valor_final = v_real / 100.0 WHERE id = (r->>'venda_id')::uuid;
    UPDATE public.contratos SET valor_cobrado = v_real / 100.0 WHERE id = (r->>'contrato_id')::uuid;
    UPDATE public.planos_2027_mensalidades SET valor_centavos = v_real
     WHERE venda_origem_id = (r->>'venda_id')::uuid AND numero = 1;
    UPDATE public.cobrancas SET valor = v_real / 100.0
     WHERE contrato_id = (r->>'contrato_id')::uuid AND numero_ciclo = 1 AND valor <> v_real / 100.0;
  END IF;

  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'venda_semestral', 'Venda do Plano Semestral registrada; aguardando 1ª mensalidade no cartão',
    jsonb_build_object('venda_id', r->>'venda_id', 'contrato_id', r->>'contrato_id', 'codigo', c.codigo, 'agregadora', c.agregadora_requerida,
      'teste_real_centavos', v_real));
  RETURN r || jsonb_build_object('agregadora', c.agregadora_requerida,
    'contrato_modelo', 'semestral_' || c.agregadora_requerida,
    'valor_centavos', (SELECT round(cb.valor * 100)::int FROM public.cobrancas cb
                        WHERE cb.contrato_id = (r->>'contrato_id')::uuid AND cb.numero_ciclo = 1));
END $function$;