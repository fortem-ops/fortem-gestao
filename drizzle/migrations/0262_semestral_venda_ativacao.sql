-- Plano Semestral, Etapa 3: venda interna e ativação (itens seguem desligados).

-- 1) fn_venda_2027_gravar: família semestral_2027 vira ciclo mensal de 30 dias; na venda só a 1ª Avaliação Funcional;
--    Treino e Bota do ciclo só após o pagamento. Demais famílias: sem mudança (patch textual verificado).
DO $mig$
DECLARE s text; t text; pares text[][] := ARRAY[
  ARRAY['  v_ehstart boolean; v_ehmensal boolean;', '  v_ehstart boolean; v_ehmensal boolean; v_sem boolean;'],
  ARRAY['  v_ciclo := v_ehstart OR (v_cons AND v_ehmensal);', E'  v_sem := c.familia = ''semestral_2027'';\n  v_ciclo := v_ehstart OR v_sem OR (v_cons AND v_ehmensal);'],
  ARRAY[E'  v_fim_ciclo := (v_ini + interval ''1 month'' - interval ''1 day'')::date;', E'  v_fim_ciclo := (v_ini + interval ''1 month'' - interval ''1 day'')::date;\n  -- Plano Semestral: ciclo de 30 dias a partir da venda.\n  IF v_sem THEN v_fim_plano := v_ini + 30; v_fim_ciclo := v_ini + 29; END IF;'],
  ARRAY[E'  IF v_cons THEN\n    NULL; -- Consultoria Online: sem crédito de Treino', E'  IF v_cons OR v_sem THEN\n    NULL; -- Consultoria: sem Treino. Semestral: Treino do ciclo só após o pagamento (fn_semestral_liberar_ciclo).'],
  ARRAY[E'  IF NOT v_cons THEN\n    INSERT INTO public.creditos_movimentos', E'  IF NOT v_cons AND NOT v_sem THEN\n    INSERT INTO public.creditos_movimentos'],
  ARRAY[E'    k := k + 1;\n', E'    k := k + 1;\n    EXIT WHEN v_sem AND k > 1; -- Semestral: só a 1ª avaliação na venda (2ª é condicional)\n'],
  ARRAY['  IF COALESCE(c.bota_compressao_mes, 0) > 0 THEN', '  IF COALESCE(c.bota_compressao_mes, 0) > 0 AND NOT v_sem THEN']
]; i int;
BEGIN
  s := pg_get_functiondef('public.fn_venda_2027_gravar(jsonb,uuid,boolean,text,text,boolean)'::regprocedure);
  FOR i IN 1..array_length(pares, 1) LOOP
    IF (length(s) - length(replace(s, pares[i][1], ''))) / length(pares[i][1]) <> 1 THEN
      RAISE EXCEPTION 'Trecho % não encontrado exatamente uma vez em fn_venda_2027_gravar', i;
    END IF;
    s := replace(s, pares[i][1], pares[i][2]);
  END LOOP;
  EXECUTE s;
END $mig$;

-- 0) Equipe lê os itens Semestral (perfil, histórico, contrato, catálogo admin); aluno e anônimo não.
ALTER POLICY catalogo_planos_oculta_agregadora ON public.planos_catalogo
  USING (agregadora_requerida IS NULL OR public.is_staff());

-- 2/3) Venda interna do Plano Semestral.
CREATE OR REPLACE FUNCTION public.fn_venda_semestral_criar(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  c public.planos_catalogo; e jsonb; r jsonb; v_teste boolean; v_enc uuid[];
BEGIN
  IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, 'coordenador'::app_role) OR public.has_role(v_uid, 'professor'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para vender o Plano Semestral';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid AND familia = 'semestral_2027';
  IF NOT FOUND OR c.agregadora_requerida IS NULL THEN RAISE EXCEPTION 'Item do Plano Semestral não encontrado'; END IF;
  e := public.fn_semestral_elegivel(v_aluno, c.codigo, v_hoje);
  IF NOT (e->>'elegivel')::boolean THEN RAISE EXCEPTION 'Plano Semestral não permitido: %', e->>'motivo'; END IF;
  v_teste := EXISTS (SELECT 1 FROM public.sistema_config sc WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
                     AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? v_aluno::text);
  -- Só recorrência no cartão, sem serviços e sem desconto; plano da agregadora é encerrado DEPOIS do insert do Semestral.
  r := public.fn_venda_2027_gravar(jsonb_build_object(
      'aluno_id', v_aluno, 'catalogo_id', c.id, 'forma', 'recorrencia', 'parcelas', 1,
      'servicos', '[]'::jsonb, 'data_inicio', v_hoje, 'primeiro_vencimento', v_hoje,
      'substituir', false, 'observacoes', p->>'observacoes', 'idempotency_key', p->>'idempotency_key'),
    v_uid, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END, 'manual', false);
  IF COALESCE((r->>'repetida')::boolean, false) THEN RETURN r; END IF;

  WITH enc AS (
    UPDATE public.planos SET ativo = false, data_fim = v_hoje
    WHERE aluno_id = v_aluno AND ativo AND tipo IN ('Gympass/Wellhub', 'Total Pass')
      AND id <> (r->>'plano_id')::uuid
    RETURNING id)
  SELECT array_agg(id) INTO v_enc FROM enc;

  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'venda_semestral', 'Venda do Plano Semestral; plano de agregadora encerrado',
    jsonb_build_object('venda_id', r->>'venda_id', 'contrato_id', r->>'contrato_id', 'codigo', c.codigo,
                       'agregadora', c.agregadora_requerida, 'planos_agregadora_encerrados', to_jsonb(v_enc)));
  RETURN r || jsonb_build_object('agregadora', c.agregadora_requerida,
    'contrato_modelo', 'semestral_' || c.agregadora_requerida,
    'planos_agregadora_encerrados', to_jsonb(COALESCE(v_enc, '{}'::uuid[])));
END $$;

-- Créditos do ciclo 1 do Semestral só com a mensalidade paga (idempotente pela competência).
CREATE OR REPLACE FUNCTION public.fn_semestral_liberar_ciclo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; c public.planos_catalogo; v_venda uuid; v_fim date; v_cred uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago' OR OLD.status = 'pago' OR NEW.numero_ciclo IS DISTINCT FROM 1 THEN RETURN NEW; END IF;
  SELECT * INTO k FROM public.contratos WHERE id = NEW.contrato_id;
  IF k.plano_tipo IS DISTINCT FROM 'semestral_2027' THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = k.catalogo_id;
  SELECT id INTO v_venda FROM public.vendas WHERE plano_id = k.plano_id AND tipo = 'plano' ORDER BY created_at LIMIT 1;
  IF v_venda IS NULL THEN RETURN NEW; END IF;
  SELECT data_fim INTO v_fim FROM public.ciclos_credito WHERE contrato_id = k.id ORDER BY data_inicio LIMIT 1;
  v_fim := COALESCE(v_fim, k.data_inicio + 29);
  INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade, competencia, reposicao_pct)
  VALUES (k.aluno_id, 'plano', v_venda, 'Treino', COALESCE(c.quantidade_creditos, 0), false, v_fim, k.data_inicio, 0)
  ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
  IF v_cred IS NOT NULL THEN
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
    VALUES (v_cred, 'compra', COALESCE(c.quantidade_creditos, 0), 'Plano Semestral ciclo 1 (pago): ' || c.codigo);
  END IF;
  IF COALESCE(c.bota_compressao_mes, 0) > 0 THEN
    v_cred := NULL;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade, competencia, reposicao_pct)
    VALUES (k.aluno_id, 'plano', v_venda, 'Recovery (Bota de Compressão)', c.bota_compressao_mes, false, v_fim, k.data_inicio, 0)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
    IF v_cred IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
      VALUES (v_cred, 'compra', c.bota_compressao_mes, 'Bota de compressão Semestral ciclo 1 — ' || c.codigo);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_semestral_liberar_ciclo AFTER UPDATE OF status ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.fn_semestral_liberar_ciclo();

REVOKE ALL ON FUNCTION public.fn_venda_semestral_criar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_semestral_criar(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_semestral_liberar_ciclo() FROM PUBLIC, anon, authenticated;