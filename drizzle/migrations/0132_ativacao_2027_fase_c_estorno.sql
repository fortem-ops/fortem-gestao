ALTER TABLE public.contratos DROP CONSTRAINT contratos_forma_pagamento_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_forma_pagamento_check CHECK (forma_pagamento = ANY (ARRAY['cartao_recorrencia'::text, 'cartao_parcelado'::text, 'pix_automatico'::text, 'boleto'::text, 'maquina_debito'::text, 'maquina_credito'::text, 'dinheiro'::text, 'pendente'::text, 'pix'::text]));
ALTER TABLE public.planos_2027_mensalidades DROP CONSTRAINT IF EXISTS planos_2027_mensalidades_status_check;
ALTER TABLE public.planos_2027_mensalidades ADD CONSTRAINT planos_2027_mensalidades_status_check CHECK (status = ANY (ARRAY['pendente'::text, 'processando'::text, 'desconhecido'::text, 'pago'::text, 'recusado'::text, 'inadimplente'::text, 'cancelado'::text, 'estornado'::text]));

CREATE TABLE public.estornos_pix_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL,
  proposta_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  status text NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado','devolvido','desconhecido','recusado')),
  txid text,
  e2e_id text,
  devolucao_id text NOT NULL,
  motivo text,
  retorno jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX estornos_pix_site_ativo_uidx ON public.estornos_pix_site(cobranca_id) WHERE status IN ('reservado','devolvido','desconhecido');
GRANT SELECT ON public.estornos_pix_site TO authenticated;
GRANT ALL ON public.estornos_pix_site TO service_role;
ALTER TABLE public.estornos_pix_site ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem estornos Pix do site" ON public.estornos_pix_site FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_cobranca_saldo_estornavel(_cobranca_id uuid)
 RETURNS TABLE(cobranca_id uuid, tid text, valor_pago numeric, total_estornado numeric, saldo_estornavel numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.tid, c.valor, t.total, greatest(c.valor - t.total, 0)
  FROM public.cobrancas c
  LEFT JOIN LATERAL (
    SELECT (CASE
      WHEN c.gateway = 'inter_pix' AND c.origem IS NOT NULL THEN
        (SELECT coalesce(sum(e.valor_centavos), 0) FROM public.estornos_pix_site e
          WHERE e.cobranca_id = c.id AND e.status IN ('reservado','devolvido','desconhecido'))
      ELSE
        (SELECT coalesce(sum(pr.amount), 0) FROM public.pagamentos_rede pr
          WHERE pr.kind = 'refund' AND pr.status = 'refunded'
            AND CASE WHEN c.origem IS NOT NULL THEN pr.cobranca_id = c.id ELSE pr.tid = c.tid END)
    END)::numeric / 100 AS total
  ) t ON true
  WHERE c.id = _cobranca_id;
$function$;

CREATE OR REPLACE FUNCTION public.fn_estorno_reservar(_cobranca_id uuid, _idempotency_key text, _valor numeric, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c            public.cobrancas%ROWTYPE;
  v_venda_id   uuid;
  v_estornado  numeric;
  v_saldo      numeric;
  v_cents      int;
  v_existente  public.pagamentos_rede%ROWTYPE;
  v_novo_id    uuid;
BEGIN
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência inválida.');
  END IF;

  SELECT * INTO v_existente FROM public.pagamentos_rede
   WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'duplicado', true,
      'status', v_existente.status,
      'pagamento_id', v_existente.id,
      'erro', 'Este estorno já foi enviado. Aguarde o resultado antes de tentar de novo.'
    );
  END IF;

  SELECT * INTO c FROM public.cobrancas WHERE id = _cobranca_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Cobrança não encontrada.');
  END IF;

  IF c.gateway IS DISTINCT FROM 'rede' OR c.tid IS NULL OR length(c.tid) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta cobrança não tem transação de cartão na Rede para estornar.');
  END IF;

  IF c.status NOT IN ('pago', 'estornado') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só é possível estornar uma cobrança paga.');
  END IF;

  SELECT coalesce(sum(pr.amount), 0)::numeric / 100 INTO v_estornado
    FROM public.pagamentos_rede pr
   WHERE CASE WHEN c.origem IS NOT NULL THEN pr.cobranca_id = c.id ELSE pr.tid = c.tid END
     AND pr.kind = 'refund'
     AND pr.status IN ('refunded', 'refund_pending');

  v_saldo := round(c.valor - v_estornado, 2);

  IF v_saldo <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta cobrança já foi totalmente estornada.');
  END IF;

  IF _valor IS NULL OR _valor <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Informe um valor de estorno maior que zero.');
  END IF;

  IF round(_valor, 2) > v_saldo THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Valor acima do saldo disponível para estorno (' || to_char(v_saldo, 'FM999999990.00') || ').'
    );
  END IF;

  SELECT v.id INTO v_venda_id FROM public.vendas v WHERE v.cobranca_id = c.id LIMIT 1;

  v_cents := round(_valor * 100)::int;

  INSERT INTO public.pagamentos_rede
    (tid, amount, installments, kind, status, cobranca_id, venda_id, created_by, idempotency_key, proposta_id, mensalidade_2027_id)
  VALUES
    (c.tid, v_cents, 1, 'refund', 'refund_pending', c.id, v_venda_id, _user_id, _idempotency_key,
     CASE WHEN c.origem IS NOT NULL THEN coalesce(
       (SELECT m.proposta_id FROM public.planos_2027_mensalidades m WHERE m.id = c.mensalidade_2027_id),
       (SELECT pp.id FROM public.propostas_planos_2027 pp WHERE pp.contrato_id = c.contrato_id LIMIT 1)) END,
     c.mensalidade_2027_id)
  RETURNING id INTO v_novo_id;

  RETURN jsonb_build_object(
    'ok', true,
    'pagamento_id', v_novo_id,
    'tid', c.tid,
    'amount_cents', v_cents,
    'valor', round(_valor, 2),
    'valor_pago', c.valor,
    'ja_estornado', v_estornado,
    'saldo_antes', v_saldo,
    'venda_id', v_venda_id,
    'numero_ciclo', c.numero_ciclo,
    'aluno_id', c.aluno_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_estorno_confirmar(_pagamento_id uuid, _motivo text, _user_id uuid, _nsu text, _authorization_code text, _return_code text, _return_message text, _raw jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p            public.pagamentos_rede%ROWTYPE;
  c            public.cobrancas%ROWTYPE;
  v_total      numeric;
  v_integral   boolean;
  v_status_ant text;
BEGIN
  SELECT * INTO p FROM public.pagamentos_rede WHERE id = _pagamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Reserva de estorno não encontrada.');
  END IF;

  UPDATE public.pagamentos_rede
     SET status = 'refunded',
         nsu = _nsu,
         authorization_code = _authorization_code,
         return_code = _return_code,
         return_message = _return_message,
         raw_response = _raw,
         motivo_estorno = _motivo
   WHERE id = _pagamento_id;

  SELECT * INTO c FROM public.cobrancas WHERE id = p.cobranca_id FOR UPDATE;
  v_status_ant := c.status;

  SELECT coalesce(sum(pr.amount), 0)::numeric / 100 INTO v_total
    FROM public.pagamentos_rede pr
   WHERE pr.kind = 'refund' AND pr.status = 'refunded'
     AND CASE WHEN c.origem IS NOT NULL THEN pr.cobranca_id = c.id ELSE pr.tid = p.tid END;

  v_integral := round(v_total, 2) >= round(c.valor, 2);

  IF v_integral THEN
    IF c.mensalidade_2027_id IS NOT NULL THEN
      -- Mensalidade do site: o espelho em cobrancas acompanha a mensalidade (as demais não mudam).
      UPDATE public.planos_2027_mensalidades SET status = 'estornado', proxima_tentativa_em = NULL WHERE id = c.mensalidade_2027_id;
    ELSE
      UPDATE public.cobrancas SET status = 'estornado' WHERE id = c.id;
    END IF;
    -- Só a venda vinculada A ESTA cobrança (vendas.cobranca_id) é estornada.
    IF p.venda_id IS NOT NULL THEN
      UPDATE public.vendas SET status_pagamento = 'estornado' WHERE id = p.venda_id;
    END IF;
    UPDATE public.inadimplencias
       SET status = 'cancelada'
     WHERE cobranca_id = c.id AND status = 'aberta';
  END IF;

  BEGIN
    INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
    VALUES (
      'cobrancas',
      c.id::text,
      'estorno',
      _user_id,
      jsonb_build_object('status', v_status_ant, 'valor', c.valor, 'tid', p.tid),
      jsonb_build_object(
        'status', CASE WHEN v_integral THEN 'estornado' ELSE v_status_ant END,
        'valor_estornado', p.amount::numeric / 100,
        'total_estornado', v_total,
        'integral', v_integral,
        'tid', p.tid,
        'nsu', _nsu,
        'return_code', _return_code,
        'return_message', _return_message,
        'motivo', _motivo,
        'pagamento_rede_id', p.id,
        'venda_id', p.venda_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_estorno_confirmar: falha ao gravar audit_log do estorno % (%): %', p.id, SQLSTATE, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'integral', v_integral,
    'valor_estornado', p.amount::numeric / 100,
    'total_estornado', v_total,
    'valor_pago', c.valor,
    'saldo_restante', greatest(round(c.valor - v_total, 2), 0),
    'cobranca_status', CASE WHEN v_integral THEN 'estornado' ELSE v_status_ant END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_validar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rede_tokenizacoes t WHERE t.id = NEW.tokenizacao_id AND t.proposta_id = NEW.proposta_id) THEN
    RAISE EXCEPTION 'token não pertence à proposta';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.proposta_id <> OLD.proposta_id OR NEW.competencia <> OLD.competencia
      OR NEW.valor_centavos <> OLD.valor_centavos OR NEW.numero <> OLD.numero) THEN
    RAISE EXCEPTION 'campos imutáveis';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' AND NEW.status NOT IN ('pago', 'estornado') THEN
    RAISE EXCEPTION 'mensalidade paga não muda de status';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'estornado' AND NEW.status <> 'estornado' THEN
    RAISE EXCEPTION 'mensalidade estornada não muda de status';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_espelho()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_aluno uuid; v_orig text; v_st text; v_pag date; v_gw text; v_tid text; v_desc text; v_id uuid;
BEGIN
  IF NEW.contrato_id IS NULL AND TG_OP = 'INSERT' THEN
    SELECT m.contrato_id INTO NEW.contrato_id FROM public.planos_2027_mensalidades m
     WHERE m.proposta_id = NEW.proposta_id AND m.contrato_id IS NOT NULL ORDER BY m.numero DESC LIMIT 1;
  END IF;
  IF NEW.contrato_id IS NULL THEN RETURN NEW; END IF;
  SELECT aluno_id INTO v_aluno FROM public.contratos WHERE id = NEW.contrato_id;
  v_orig := CASE WHEN coalesce((SELECT teste_admin FROM public.propostas_planos_2027 WHERE id = NEW.proposta_id), false)
                   OR public.fn_checkout_2027_teste(NEW.proposta_id) THEN 'teste_2027' ELSE 'site_2027' END;
  v_st := CASE NEW.status WHEN 'pago' THEN 'pago' WHEN 'cancelado' THEN 'cancelado'
            WHEN 'estornado' THEN 'estornado' WHEN 'recusado' THEN 'atrasado' WHEN 'inadimplente' THEN 'atrasado' ELSE 'pendente' END;
  IF NEW.status IN ('pago', 'estornado') THEN
    v_pag := (coalesce(NEW.pago_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
    v_gw := CASE NEW.baixa_manual_forma WHEN 'pix' THEN 'inter_pix' WHEN 'dinheiro' THEN 'dinheiro' ELSE 'rede' END;
    v_tid := coalesce((SELECT pr.tid FROM public.pagamentos_rede pr WHERE pr.mensalidade_2027_id = NEW.id AND pr.status = 'approved' ORDER BY pr.created_at DESC LIMIT 1), NEW.tid);
  END IF;
  v_desc := 'Mensalidade ' || NEW.numero || CASE WHEN (SELECT familia FROM public.propostas_planos_2027 WHERE id = NEW.proposta_id) = 'start_2027' THEN '' ELSE '/12' END
    || ' — assinatura do site';
  PERFORM set_config('fortem.espelho_2027', 'on', true);
  IF NEW.cobranca_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.cobrancas WHERE id = NEW.cobranca_id) THEN
    UPDATE public.cobrancas SET contrato_id = NEW.contrato_id, aluno_id = v_aluno, status = v_st, data_pagamento = v_pag,
      gateway = v_gw, tid = v_tid, tentativas = NEW.tentativas, motivo_recusa = CASE WHEN v_st = 'atrasado' THEN left(NEW.motivo, 120) END,
      origem = v_orig
     WHERE id = NEW.cobranca_id
       AND (contrato_id, aluno_id, status, data_pagamento, gateway, tid, tentativas, origem)
           IS DISTINCT FROM (NEW.contrato_id, v_aluno, v_st, v_pag, v_gw, v_tid, NEW.tentativas::int, v_orig);
  ELSE
    INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, data_pagamento, status,
      forma_pagamento, meio_registro, gateway, tid, tentativas, descricao, composicao, origem, mensalidade_2027_id)
    VALUES (NEW.contrato_id, v_aluno, NEW.numero, NEW.valor_centavos / 100.0, NEW.vencimento, v_pag, v_st,
      'cartao_recorrencia', 'site_2027', v_gw, v_tid, NEW.tentativas, v_desc,
      jsonb_build_object('plano', NEW.valor_centavos / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb), v_orig, NEW.id)
    ON CONFLICT (mensalidade_2027_id) WHERE mensalidade_2027_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
    NEW.cobranca_id := coalesce(v_id, (SELECT id FROM public.cobrancas WHERE mensalidade_2027_id = NEW.id));
  END IF;
  PERFORM set_config('fortem.espelho_2027', 'off', true);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_estorno_pix_site_reservar(_cobranca_id uuid, _idempotency_key text, _user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.cobrancas%ROWTYPE; e public.estornos_pix_site%ROWTYPE; v_prop uuid; v_id uuid := gen_random_uuid();
BEGIN
  IF _user_id IS NULL OR NOT public.is_admin(_user_id) THEN RETURN jsonb_build_object('ok', false, 'erro', 'Apenas administradores podem devolver Pix.'); END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 10 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência inválida.'); END IF;
  SELECT * INTO e FROM public.estornos_pix_site WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('ok', false, 'duplicado', true, 'status', e.status, 'erro', 'Esta devolução já foi enviada. Aguarde o resultado antes de tentar de novo.'); END IF;
  SELECT * INTO c FROM public.cobrancas WHERE id = _cobranca_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Cobrança não encontrada.'); END IF;
  IF c.gateway IS DISTINCT FROM 'inter_pix' OR c.origem IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só cobranças Pix de compras do site podem ser devolvidas por aqui.'); END IF;
  IF c.mensalidade_2027_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade recebida por baixa manual: devolva fora do sistema.'); END IF;
  IF c.status <> 'pago' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só é possível devolver uma cobrança paga.'); END IF;
  IF c.tid IS NULL OR NOT EXISTS (SELECT 1 FROM public.pix_cobrancas pc WHERE pc.txid = c.tid AND pc.liquidado_em IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pix recebido não encontrado para esta cobrança.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.estornos_pix_site WHERE cobranca_id = c.id AND status IN ('reservado','devolvido','desconhecido')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta cobrança já tem devolução feita ou em conferência.');
  END IF;
  SELECT pp.id INTO v_prop FROM public.propostas_planos_2027 pp WHERE pp.contrato_id = c.contrato_id LIMIT 1;
  INSERT INTO public.estornos_pix_site (id, cobranca_id, proposta_id, idempotency_key, valor_centavos, txid, devolucao_id, created_by)
  VALUES (v_id, c.id, v_prop, _idempotency_key, round(c.valor * 100)::int, c.tid, left('dev' || replace(v_id::text, '-', ''), 35), _user_id);
  RETURN jsonb_build_object('ok', true, 'estorno_id', v_id, 'txid', c.tid, 'valor', c.valor,
    'devolucao_id', left('dev' || replace(v_id::text, '-', ''), 35), 'aluno_id', c.aluno_id, 'numero_ciclo', c.numero_ciclo,
    'e2e_salvo', (SELECT coalesce(pc.raw_response->>'endToEndId', pc.raw_response#>>'{pix,0,endToEndId}') FROM public.pix_cobrancas pc WHERE pc.txid = c.tid AND pc.liquidado_em IS NOT NULL ORDER BY pc.liquidado_em DESC LIMIT 1));
END $function$;

CREATE OR REPLACE FUNCTION public.fn_estorno_pix_site_resultado(_estorno_id uuid, _status text, _e2e text, _retorno jsonb, _motivo text, _user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e public.estornos_pix_site%ROWTYPE; c public.cobrancas%ROWTYPE;
BEGIN
  IF _status NOT IN ('devolvido','recusado','desconhecido') THEN RAISE EXCEPTION 'status inválido'; END IF;
  SELECT * INTO e FROM public.estornos_pix_site WHERE id = _estorno_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Devolução não encontrada.'); END IF;
  IF e.status = 'devolvido' THEN RETURN jsonb_build_object('ok', true, 'ja_registrado', true); END IF;
  UPDATE public.estornos_pix_site SET status = _status, e2e_id = coalesce(_e2e, e2e_id), retorno = _retorno, motivo = _motivo, updated_at = now() WHERE id = e.id;
  IF _status = 'devolvido' THEN
    SELECT * INTO c FROM public.cobrancas WHERE id = e.cobranca_id FOR UPDATE;
    UPDATE public.cobrancas SET status = 'estornado' WHERE id = c.id;
    UPDATE public.pix_cobrancas SET status = 'DEVOLVIDA' WHERE txid = e.txid AND liquidado_em IS NOT NULL;
    UPDATE public.inadimplencias SET status = 'cancelada' WHERE cobranca_id = c.id AND status = 'aberta';
    BEGIN
      INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
      VALUES ('cobrancas', c.id::text, 'estorno', _user_id,
        jsonb_build_object('status', c.status, 'valor', c.valor, 'txid', e.txid),
        jsonb_build_object('status', 'estornado', 'valor_estornado', e.valor_centavos / 100.0, 'integral', true,
          'meio', 'pix', 'e2e_id', coalesce(_e2e, e.e2e_id), 'devolucao_id', e.devolucao_id, 'motivo', _motivo, 'estorno_pix_id', e.id));
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'audit estorno pix: %', SQLERRM; END;
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', _status, 'valor_estornado', e.valor_centavos / 100.0);
END $function$;
REVOKE ALL ON FUNCTION public.fn_estorno_pix_site_reservar(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_estorno_pix_site_resultado(uuid, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estorno_pix_site_reservar(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_estorno_pix_site_resultado(uuid, text, text, jsonb, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ativar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r public.propostas_planos_2027; c public.planos_catalogo; ac public.propostas_2027_aceites;
  v_teste boolean; v_aluno uuid; v_vinc text; v_cnt int; v_forma text; v_servs jsonb; v_res jsonb;
  v_ini date; v_ct jsonb; v_contrato uuid; v_venda uuid; v_status text;
  v_orig text; v_gw text; v_tid text; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_encerrados int := 0; v_pl record;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF r.ativada_em IS NOT NULL THEN
    RETURN jsonb_build_object('ja_ativada', true, 'venda_id', r.venda_id, 'contrato_id', r.contrato_id, 'aluno_id', r.aluno_ativado_id);
  END IF;
  IF r.pago_em IS NULL THEN RAISE EXCEPTION 'Proposta sem pagamento confirmado'; END IF;
  v_teste := r.teste_admin OR public.fn_checkout_2027_teste(r.id);
  v_ct := coalesce(r.contratante, '{}'::jsonb);

  IF v_teste THEN
    SELECT a.id INTO v_aluno FROM public.alunos a, public.sistema_config sc
     WHERE a.nome = 'NICOLAS TESTE' AND sc.chave = 'vendas_2027_teste_aluno_ids' AND sc.valor ? a.id::text
     ORDER BY a.created_at LIMIT 1;
    IF v_aluno IS NULL THEN RAISE EXCEPTION 'Cadastro de teste não encontrado'; END IF;
    v_vinc := 'teste';
  ELSIF r.aluno_id IS NOT NULL AND r.verificacao_id IS NOT NULL THEN
    v_aluno := r.aluno_id; v_vinc := 'verificado';
  ELSIF r.cpf_hash IS NOT NULL AND EXISTS (SELECT 1 FROM public.alunos WHERE cpf_hash = r.cpf_hash) THEN
    SELECT count(*), min(id::text)::uuid INTO v_cnt, v_aluno FROM public.alunos WHERE cpf_hash = r.cpf_hash;
    IF v_cnt > 1 THEN RAISE EXCEPTION 'CPF em mais de um cadastro: vincular manualmente'; END IF;
    v_vinc := 'cpf';
  ELSE
    IF r.cpf_hash IS NULL THEN RAISE EXCEPTION 'Proposta sem CPF do contratante'; END IF;
    INSERT INTO public.alunos (nome, email, telefone, data_nascimento, status, cep, logradouro, numero, complemento,
      bairro, cidade, uf, rg, cpf_hash, cpf_ultimos3, observacoes)
    VALUES (coalesce(nullif(v_ct->>'nome',''), r.nome), coalesce(nullif(v_ct->>'email',''), r.email), r.whatsapp,
      nullif(v_ct->>'data_nascimento','')::date, 'ativo', v_ct->>'cep', v_ct->>'logradouro', v_ct->>'numero',
      v_ct->>'complemento', v_ct->>'bairro', v_ct->>'cidade', v_ct->>'uf', nullif(v_ct->>'rg',''),
      r.cpf_hash, r.cpf_ultimos3, 'Cadastro criado pela compra no site (/planos)')
    RETURNING id INTO v_aluno;
    v_vinc := 'novo';
  END IF;

  IF NOT v_teste THEN
    SELECT status INTO v_status FROM public.alunos WHERE id = v_aluno;
    IF v_status IS DISTINCT FROM 'ativo' THEN UPDATE public.alunos SET status = 'ativo' WHERE id = v_aluno; END IF;
  END IF;

  SELECT * INTO c FROM public.planos_catalogo WHERE codigo = r.plano_codigo AND versao = 2027;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item 2027 da proposta não encontrado'; END IF;
  SELECT coalesce(jsonb_agg(sc.id ORDER BY x.ord), '[]'::jsonb), count(*) INTO v_servs, v_cnt
    FROM unnest(coalesce(r.servicos_codigos, ARRAY[]::text[])) WITH ORDINALITY x(cod, ord)
    JOIN public.servicos_catalogo sc ON sc.codigo = x.cod AND sc.versao = 2027;
  IF v_cnt <> coalesce(array_length(r.servicos_codigos, 1), 0) THEN RAISE EXCEPTION 'Serviço 2027 da proposta não encontrado'; END IF;

  v_forma := CASE WHEN r.pagamento_tipo = 'pix' THEN 'pix_vista' ELSE r.forma_plano END;
  v_ini := (r.pago_em AT TIME ZONE 'America/Sao_Paulo')::date;

  FOR v_pl IN
    SELECT p.id FROM public.planos p
     WHERE p.aluno_id = v_aluno AND p.ativo AND p.atividade = 'treinamento_funcional'
       AND coalesce((SELECT k.data_fim FROM public.contratos k WHERE k.plano_id = p.id ORDER BY k.created_at DESC LIMIT 1), p.data_fim) <= v_hoje
  LOOP
    UPDATE public.contratos SET status = 'encerrado',
      observacoes = coalesce(observacoes || ' | ', '') || 'Encerrado: fim do contrato, nova compra no site em ' || v_hoje
     WHERE plano_id = v_pl.id AND status IN ('ativo', 'suspenso');
    UPDATE public.planos SET ativo = false WHERE id = v_pl.id;
    v_encerrados := v_encerrados + 1;
  END LOOP;

  v_res := public.fn_venda_2027_gravar(jsonb_build_object(
      'aluno_id', v_aluno, 'catalogo_id', c.id, 'forma', v_forma,
      'parcelas', coalesce(r.pagamento_parcelas, r.parcelas_plano, 1),
      'servicos', v_servs, 'forma_servicos', coalesce(r.forma_servicos, 'pix_vista'),
      'parcelas_servicos', coalesce(r.parcelas_servicos, 1),
      'data_inicio', v_ini, 'idempotency_key', 'planos:' || r.id,
      'observacoes', 'Venda do site /planos — proposta ' || left(r.id::text, 8)),
    NULL, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END, 'online', v_forma = 'recorrencia');

  v_venda := (v_res->>'venda_id')::uuid;
  v_contrato := coalesce((v_res->>'contrato_id')::uuid, (SELECT k.id FROM public.contratos k JOIN public.vendas v ON v.plano_id = k.plano_id WHERE v.id = v_venda ORDER BY k.created_at DESC LIMIT 1));

  IF r.aceite_id IS NOT NULL THEN
    SELECT * INTO ac FROM public.propostas_2027_aceites WHERE id = r.aceite_id;
    IF FOUND THEN
      INSERT INTO public.contratos_documentos (contrato_id, aluno_id, template_id, template_versao, regulamento_versao,
        conteudo_gerado, variaveis_utilizadas, aceite, data_aceite, formato_aceite, ip_aceite, hash_texto, user_agent, origem, proposta_id)
      VALUES (v_contrato, v_aluno, ac.template_id, ac.template_versao, ac.regulamento_versao, ac.conteudo_html,
        ac.variaveis, true, ac.aceito_em, 'site', ac.ip, ac.hash_texto, ac.user_agent,
        CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END, r.id)
      ON CONFLICT (proposta_id) WHERE proposta_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  v_orig := CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END;
  IF v_forma = 'recorrencia' THEN
    UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE proposta_id = r.id AND contrato_id IS NULL;
  ELSE
    IF r.pagamento_tipo = 'pix' THEN
      v_gw := 'inter_pix';
      SELECT txid INTO v_tid FROM public.pix_cobrancas WHERE proposta_id = r.id AND liquidado_em IS NOT NULL ORDER BY liquidado_em DESC LIMIT 1;
    ELSE
      v_gw := 'rede';
      SELECT tid INTO v_tid FROM public.pagamentos_rede WHERE proposta_id = r.id AND status = 'approved' AND mensalidade_2027_id IS NULL ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF v_tid IS NULL THEN
      SELECT ref INTO v_tid FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND status IN ('aprovado', 'pago') ORDER BY updated_at DESC LIMIT 1;
    END IF;
    UPDATE public.cobrancas SET status = 'pago', data_pagamento = v_ini, gateway = v_gw, tid = v_tid,
      meio_registro = 'site_2027', origem = v_orig
     WHERE contrato_id = v_contrato AND status = 'pendente';
    IF r.pagamento_tipo = 'pix' THEN UPDATE public.contratos SET forma_pagamento = 'pix' WHERE id = v_contrato; END IF;
  END IF;
  UPDATE public.vendas SET status_pagamento = 'pago'
   WHERE (id = v_venda OR id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(coalesce(v_res->'servico_venda_ids', '[]'::jsonb)) x))
     AND status_pagamento = 'pendente';

  UPDATE public.propostas_planos_2027 SET aluno_ativado_id = v_aluno, venda_id = v_venda, contrato_id = v_contrato,
    ativada_em = now(), ativacao_vinculo = v_vinc, ativacao_erro = NULL, ativacao_erro_em = NULL,
    aluno_id = CASE WHEN v_teste THEN aluno_id ELSE coalesce(aluno_id, v_aluno) END
  WHERE id = r.id;

  RETURN jsonb_build_object('ativada', true, 'aluno_id', v_aluno, 'vinculo', v_vinc, 'venda_id', v_venda,
    'contrato_id', v_contrato, 'teste', v_teste, 'planos_antigos_encerrados', v_encerrados, 'corrida_pendente', coalesce(r.corrida, false));
END $function$;