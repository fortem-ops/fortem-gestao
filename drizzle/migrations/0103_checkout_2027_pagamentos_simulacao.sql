ALTER TABLE public.pix_cobrancas ADD COLUMN IF NOT EXISTS proposta_id uuid;
ALTER TABLE public.pagamentos_rede ADD COLUMN IF NOT EXISTS proposta_id uuid;
ALTER TABLE public.rede_tokenizacoes ADD COLUMN IF NOT EXISTS proposta_id uuid;
CREATE INDEX IF NOT EXISTS pix_cobrancas_proposta_idx ON public.pix_cobrancas(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pagamentos_rede_proposta_idx ON public.pagamentos_rede(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rede_tokenizacoes_proposta_idx ON public.rede_tokenizacoes(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pix_cobrancas_proposta_ativa_uq ON public.pix_cobrancas(proposta_id) WHERE proposta_id IS NOT NULL AND status IN ('CRIADA','ATIVA');
ALTER TABLE public.pix_cobrancas DROP CONSTRAINT pix_cobrancas_origem_check;
ALTER TABLE public.pix_cobrancas ADD CONSTRAINT pix_cobrancas_origem_check CHECK (id_rec IS NOT NULL OR pedido_id IS NOT NULL OR corrida_venda_id IS NOT NULL OR proposta_id IS NOT NULL);

ALTER TABLE public.propostas_planos_2027 ADD COLUMN IF NOT EXISTS pago_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_tipo text, ADD COLUMN IF NOT EXISTS pagamento_ref text;

-- Tentativas de pagamento do checkout (simuladas ou reais). Sem CPF e sem dados de cartão.
CREATE TABLE public.checkout_2027_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas_planos_2027(id) ON DELETE CASCADE,
  aceite_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('pix','cartao')),
  simulado boolean NOT NULL DEFAULT true,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  total_proposta_centavos integer NOT NULL,
  parcelas integer NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','expirado')),
  expira_em timestamptz,
  ref text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkout_2027_tentativas_prop_idx ON public.checkout_2027_tentativas(proposta_id, created_at DESC);
GRANT ALL ON public.checkout_2027_tentativas TO service_role;
ALTER TABLE public.checkout_2027_tentativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem tentativas" ON public.checkout_2027_tentativas FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.checkout_2027_tentativas TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_tentativa_json(t public.checkout_2027_tentativas)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id', t.id, 'tipo', t.tipo, 'simulado', t.simulado,
    'valor_centavos', t.valor_centavos, 'total_proposta_centavos', t.total_proposta_centavos, 'parcelas', t.parcelas,
    'status', t.status, 'expira_em', t.expira_em, 'motivo', t.motivo) END
$$;

-- Prepara a tentativa: valida sessão/aceite, recalcula, define modo e valor (trava no servidor).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pagamento_iniciar(p_proposta_id uuid, p_chave text, p_tipo text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027; c jsonb; t public.checkout_2027_tentativas;
  v_teste boolean; v_modo text; v_max int; v_total int; v_valor int; v_simulado boolean; v_parc int; n int;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout = 'paga' THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF r.etapa_checkout NOT IN ('contrato_aceito','aguardando_pagamento','falhou') OR r.aceite_id IS NULL THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  c := public.fn_checkout_2027_calcular(p_proposta_id);
  IF c IS DISTINCT FROM (r.revisao - 'etapa') AND (c->>'total_centavos') IS DISTINCT FROM (r.revisao->>'total_centavos') THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  IF p_tipo = 'pix' AND c->>'forma_plano' <> 'pix_vista' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF p_tipo = 'cartao' AND c->>'forma_plano' <> 'cartao_parcelado' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF p_tipo NOT IN ('pix','cartao') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;

  -- Pix: reaproveita cobrança pendente e válida.
  IF p_tipo = 'pix' THEN
    SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='pix' AND status='pendente'
      AND expira_em > now() ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('reutilizada', true); END IF;
  ELSE
    SELECT count(*) INTO n FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao' AND created_at > now() - interval '30 minutes';
    IF n >= 3 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  END IF;

  v_total := (c->>'total_centavos')::int;
  v_parc := CASE WHEN p_tipo = 'cartao' THEN greatest(1, least(12, coalesce((c->>'parcelas_plano')::int, 1))) ELSE 1 END;
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT (valor #>> '{}')::int INTO v_max FROM public.sistema_config WHERE chave = 'planos_teste_valor_max_centavos';
  v_modo := coalesce(v_modo, 'simulacao'); v_max := coalesce(v_max, 100);

  IF v_teste OR NOT public.fn_checkout_2027_ativo() THEN
    IF v_modo = 'real_baixo_valor' AND v_teste THEN
      v_simulado := false; v_valor := least(v_total, v_max); v_parc := 1;
      UPDATE public.sistema_config SET valor = to_jsonb('simulacao'::text), updated_at = now() WHERE chave = 'planos_pagamento_modo_teste';
    ELSE
      v_simulado := true; v_valor := v_total;
    END IF;
  ELSE
    v_simulado := false; v_valor := v_total;
  END IF;

  INSERT INTO public.checkout_2027_tentativas(proposta_id, aceite_id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, expira_em)
  VALUES (r.id, r.aceite_id, p_tipo, v_simulado, v_valor, v_total, v_parc, CASE WHEN p_tipo='pix' THEN now() + interval '30 minutes' END)
  RETURNING * INTO t;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='aguardando_pagamento', etapa_atualizada_em=now() WHERE id = r.id;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('reutilizada', false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ativo() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (valor #>> '{}')::boolean FROM public.sistema_config WHERE chave='planos_checkout_ativo'), false)
$$;

-- Status para a tela; expira Pix vencido.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pagamento_status(p_proposta_id uuid, p_chave text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027; t public.checkout_2027_tentativas;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  UPDATE public.checkout_2027_tentativas SET status='expirado', updated_at=now()
   WHERE proposta_id = r.id AND tipo='pix' AND status='pendente' AND expira_em <= now();
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object('etapa', r.etapa_checkout, 'tentativa', public.fn_checkout_2027_tentativa_json(t), 'ref', t.ref);
END $$;

-- Grava referência/resultado de uma tentativa (usado pelo servidor; simulação ou retorno do provedor).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_tentativa_atualizar(p_tentativa_id uuid, p_status text, p_ref text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.checkout_2027_tentativas;
BEGIN
  IF p_status NOT IN ('pendente','aprovado','recusado','expirado') THEN RAISE EXCEPTION 'status inválido'; END IF;
  UPDATE public.checkout_2027_tentativas SET status = p_status, ref = coalesce(p_ref, ref), motivo = left(p_motivo, 120), updated_at = now()
   WHERE id = p_tentativa_id AND (status = 'pendente' OR (status = p_status)) RETURNING * INTO t;
  IF NOT FOUND THEN SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id; END IF;
  IF t.status = 'recusado' THEN
    UPDATE public.propostas_planos_2027 SET etapa_checkout='falhou', etapa_atualizada_em=now() WHERE id=t.proposta_id AND etapa_checkout='aguardando_pagamento';
  END IF;
  RETURN public.fn_checkout_2027_tentativa_json(t);
END $$;

-- Somente simulação: define o resultado de uma tentativa simulada de proposta de teste.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_simular_resultado(p_tentativa_id uuid, p_resultado text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.checkout_2027_tentativas;
BEGIN
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id FOR UPDATE;
  IF NOT FOUND OR NOT t.simulado OR NOT public.fn_checkout_2027_teste(t.proposta_id) THEN RAISE EXCEPTION 'Checkout indisponível no momento'; END IF;
  IF p_resultado = 'expirado' THEN
    UPDATE public.checkout_2027_tentativas SET expira_em = now() - interval '1 second', updated_at=now() WHERE id = t.id AND status='pendente';
    RETURN public.fn_checkout_2027_tentativa_atualizar(t.id, 'expirado', NULL, 'simulado');
  END IF;
  RETURN public.fn_checkout_2027_tentativa_atualizar(t.id, p_resultado, 'SIMULACAO-' || left(t.id::text, 8), 'simulado');
END $$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_pagamento_status(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_tentativa_atualizar(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_simular_resultado(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_ativo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_tentativa_json(public.checkout_2027_tentativas) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pagamento_status(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_tentativa_atualizar(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_simular_resultado(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_ativo() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_tentativa_json(public.checkout_2027_tentativas) TO service_role;