-- Parte 4: compra avulsa de Recovery pelo portal (crédito só após pagamento).
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS liberar_apos_pagamento boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.servicos_catalogo.liberar_apos_pagamento IS 'Crédito do serviço só é criado quando a venda fica paga (uma vez por venda) e é retirado, se não usado, em estorno/cancelamento.';

CREATE TABLE public.vendas_creditos_pos_pagamento (
  venda_id uuid PRIMARY KEY REFERENCES public.vendas(id) ON DELETE CASCADE,
  credito_id uuid NOT NULL REFERENCES public.creditos_aluno(id) ON DELETE CASCADE,
  liberado_em timestamptz NOT NULL DEFAULT now(),
  retirado_em timestamptz
);
GRANT SELECT ON public.vendas_creditos_pos_pagamento TO authenticated;
GRANT ALL ON public.vendas_creditos_pos_pagamento TO service_role;
ALTER TABLE public.vendas_creditos_pos_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê controle de crédito pós-pagamento" ON public.vendas_creditos_pos_pagamento
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE OR REPLACE FUNCTION public.fn_processar_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cat_plano record;
  _cat_serv record;
  _novo_plano_id uuid;
  _credito_id uuid;
  _qtd int;
  _ilim bool;
  _valor_plano numeric;
  _freq_sem smallint;
BEGIN
  IF NEW.status_pagamento = 'cancelado' THEN
    RETURN NEW;
  END IF;

  -- Planos/serviços 2027: tudo é criado por fn_venda_2027_criar (legado segue abaixo sem mudança).
  IF NEW.catalogo_id IS NOT NULL AND (
       (NEW.tipo = 'plano' AND EXISTS (SELECT 1 FROM public.planos_catalogo c WHERE c.id = NEW.catalogo_id AND c.versao = 2027))
    OR (NEW.tipo = 'servico' AND EXISTS (SELECT 1 FROM public.servicos_catalogo s WHERE s.id = NEW.catalogo_id AND s.versao = 2027))
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'plano' THEN
    SELECT * INTO _cat_plano FROM public.planos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_plano IS NULL THEN RAISE EXCEPTION 'Plano de catálogo não encontrado'; END IF;

    _valor_plano := COALESCE(NEW.valor_final, NEW.valor, _cat_plano.valor);

    IF NEW.plano_id IS NULL THEN
      INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade)
      VALUES (NEW.aluno_id, _cat_plano.nome, NEW.data_venda, _cat_plano.periodo_meses, _valor_plano, true, ARRAY[]::text[], _cat_plano.atividade)
      RETURNING id INTO _novo_plano_id;

      NEW.plano_id := _novo_plano_id;
    END IF;

    _qtd := COALESCE(_cat_plano.quantidade_creditos, 0);
    _ilim := _cat_plano.ilimitado;

    SELECT id INTO _credito_id
    FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id
      AND atividade = 'Treino'
      AND origem_tipo = 'plano'
      AND origem_id = NEW.id
      AND ativo = true
    LIMIT 1;

    IF _credito_id IS NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
      VALUES (NEW.aluno_id, 'plano', NEW.id, 'Treino', _qtd, _ilim,
              (NEW.data_venda + (_cat_plano.periodo_meses || ' months')::interval)::date)
      RETURNING id INTO _credito_id;

      IF _credito_id IS NOT NULL THEN
        INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
        VALUES (_credito_id, 'compra', _qtd, NEW.vendedor_id, 'Plano: ' || _cat_plano.nome);
      END IF;
    END IF;

    -- Fonte oficial dos "créditos previstos" do contrato: o pacote realmente vendido.
    -- O gatilho fn_auto_criar_contrato_ciclo cria o contrato com frequência do cadastro x 4;
    -- aqui o valor é sobrescrito pelo que consta no catálogo da venda.
    IF COALESCE(_cat_plano.atividade, '') <> 'corrida' AND NEW.plano_id IS NOT NULL THEN
      _freq_sem := CASE
        WHEN COALESCE(_cat_plano.frequencia::text, '') = 'livre' THEN 5
        WHEN COALESCE(_cat_plano.frequencia::text, '') ~ '^[0-9]+x?$'
          THEN COALESCE(NULLIF(regexp_replace(_cat_plano.frequencia::text, '\D', '', 'g'), '')::smallint, 1)
        ELSE NULL
      END;
      IF _freq_sem IS NOT NULL AND _freq_sem NOT IN (1,2,3,5) THEN _freq_sem := NULL; END IF;

      UPDATE public.contratos
      SET creditos_total = _qtd,
          frequencia_semanal = COALESCE(_freq_sem, frequencia_semanal)
      WHERE plano_id = NEW.plano_id;

      UPDATE public.ciclos_credito
      SET creditos_liberados = _qtd
      WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = NEW.plano_id);
    END IF;

  ELSIF NEW.tipo = 'servico' THEN
    SELECT * INTO _cat_serv FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_serv IS NULL THEN RAISE EXCEPTION 'Serviço de catálogo não encontrado'; END IF;

    SELECT id INTO _credito_id
    FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id
      AND atividade = _cat_serv.atividade
      AND origem_tipo = 'servico'
      AND origem_id = NEW.id
      AND ativo = true
    LIMIT 1;

    -- Itens com liberar_apos_pagamento (ex.: Recovery avulso do portal): crédito só quando a venda fica 'pago'
    -- (gatilho trg_vendas_credito_apos_pagamento). Demais serviços seguem sem mudança.
    IF COALESCE(_cat_serv.liberar_apos_pagamento, false) THEN
      RETURN NEW;
    END IF;

    IF _credito_id IS NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
      VALUES (NEW.aluno_id, 'servico', NEW.id, _cat_serv.atividade, _cat_serv.quantidade_sessoes, false)
      RETURNING id INTO _credito_id;

      IF _credito_id IS NOT NULL THEN
        INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
        VALUES (_credito_id, 'compra', _cat_serv.quantidade_sessoes, NEW.vendedor_id, 'Serviço: ' || _cat_serv.nome);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.fn_vendas_credito_apos_pagamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cat record; _cred uuid; _ctl record; _c record;
BEGIN
  IF NEW.tipo IS DISTINCT FROM 'servico' OR NEW.catalogo_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _cat FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
  IF _cat IS NULL OR NOT COALESCE(_cat.liberar_apos_pagamento, false) THEN RETURN NEW; END IF;

  IF NEW.status_pagamento = 'pago' AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM 'pago') THEN
    PERFORM pg_advisory_xact_lock(hashtext('credito_pos_pagamento:' || NEW.id::text));
    IF EXISTS (SELECT 1 FROM public.vendas_creditos_pos_pagamento WHERE venda_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
    VALUES (NEW.aluno_id, 'servico', NEW.id, _cat.atividade, _cat.quantidade_sessoes, false)
    RETURNING id INTO _cred;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (_cred, 'compra', _cat.quantidade_sessoes, NEW.vendedor_id, 'Serviço (após pagamento): ' || _cat.nome);
    INSERT INTO public.vendas_creditos_pos_pagamento (venda_id, credito_id) VALUES (NEW.id, _cred);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status_pagamento = 'pago'
     AND NEW.status_pagamento IN ('estornado','cancelado') THEN
    SELECT * INTO _ctl FROM public.vendas_creditos_pos_pagamento WHERE venda_id = NEW.id AND retirado_em IS NULL;
    IF _ctl IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO _c FROM public.creditos_aluno WHERE id = _ctl.credito_id FOR UPDATE;
    IF _c IS NULL THEN RETURN NEW; END IF;
    IF _c.quantidade_usada < _c.quantidade_inicial THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
      VALUES (_c.id, 'estorno', _c.quantidade_inicial - _c.quantidade_usada, auth.uid(), 'Venda ' || NEW.status_pagamento::text || ': crédito não usado retirado');
    END IF;
    IF _c.quantidade_usada = 0 THEN
      UPDATE public.creditos_aluno SET ativo = false, updated_at = now() WHERE id = _c.id;
    ELSE
      UPDATE public.creditos_aluno SET quantidade_inicial = quantidade_usada, updated_at = now() WHERE id = _c.id;
    END IF;
    UPDATE public.vendas_creditos_pos_pagamento SET retirado_em = now() WHERE venda_id = NEW.id;
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload, user_id)
    VALUES ('vendas','credito_pos_pagamento_retirado', 'Crédito não usado retirado após ' || NEW.status_pagamento::text,
      jsonb_build_object('venda_id', NEW.id, 'credito_id', _c.id, 'usado', _c.quantidade_usada), auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fn_vendas_credito_apos_pagamento() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_vendas_credito_apos_pagamento
AFTER INSERT OR UPDATE OF status_pagamento ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.fn_vendas_credito_apos_pagamento();

CREATE OR REPLACE FUNCTION public.fn_portal_recovery_avulso_link()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_aluno uuid; v_cat record; v_venda uuid; v_token text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT a.id INTO v_aluno FROM public.alunos a WHERE a.user_id = auth.uid() LIMIT 1;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'aluno_nao_encontrado'; END IF;

  SELECT * INTO v_cat FROM public.servicos_catalogo
   WHERE codigo = 'recovery_avulso' AND ativo AND liberar_apos_pagamento LIMIT 1;
  IF v_cat IS NULL OR COALESCE(v_cat.valor,0) <= 0 THEN RAISE EXCEPTION 'item_indisponivel'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('recovery_avulso:' || v_aluno::text));

  SELECT v.id INTO v_venda FROM public.vendas v
   WHERE v.aluno_id = v_aluno AND v.catalogo_id = v_cat.id AND v.origem = 'portal_avulso'
     AND v.status_pagamento = 'pendente' AND v.valor_final = v_cat.valor
     AND v.created_at > now() - interval '7 days'
   ORDER BY v.created_at DESC LIMIT 1;

  IF v_venda IS NULL THEN
    INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
                               status_pagamento, origem, parcelas, canal_pagamento)
    VALUES (v_aluno, 'servico', v_cat.id, v_cat.nome, v_cat.valor, 0, v_cat.valor,
            'pendente', 'portal_avulso', 1, 'online')
    RETURNING id INTO v_venda;
  END IF;

  SELECT l.token INTO v_token FROM public.links_pagamento l
   WHERE l.venda_id = v_venda AND l.usado_em IS NULL AND l.expira_em > now() + interval '30 minutes'
   ORDER BY l.criado_em DESC LIMIT 1;
  IF v_token IS NULL THEN
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    INSERT INTO public.links_pagamento (venda_id, token, criado_por, expira_em)
    VALUES (v_venda, v_token, auth.uid(), now() + interval '24 hours');
  END IF;

  RETURN jsonb_build_object('token', v_token, 'venda_id', v_venda, 'valor', v_cat.valor);
END $$;
REVOKE ALL ON FUNCTION public.fn_portal_recovery_avulso_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_portal_recovery_avulso_link() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_portal_recovery_avulso_preco()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT valor FROM public.servicos_catalogo
   WHERE codigo = 'recovery_avulso' AND ativo AND liberar_apos_pagamento AND auth.uid() IS NOT NULL LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.fn_portal_recovery_avulso_preco() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_portal_recovery_avulso_preco() TO authenticated;