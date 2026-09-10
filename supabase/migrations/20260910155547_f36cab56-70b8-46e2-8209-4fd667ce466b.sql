-- 1. idempotência em pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_idempotency_key_uidx
  ON public.pedidos (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. rate limit próprio da loja
CREATE TABLE IF NOT EXISTS public.rate_limit_loja_publico (
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  janela_min bigint NOT NULL,
  contagem integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_address, endpoint, janela_min)
);

GRANT ALL ON public.rate_limit_loja_publico TO service_role;
ALTER TABLE public.rate_limit_loja_publico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limit_loja_publico_admin_read ON public.rate_limit_loja_publico;
CREATE POLICY rate_limit_loja_publico_admin_read
  ON public.rate_limit_loja_publico FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

-- 3. criação atômica de pedido + reserva de estoque
CREATE OR REPLACE FUNCTION public.fn_loja_criar_pedido(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _idem text := nullif(btrim(coalesce(p_payload->>'idempotency_key','')), '');
  _nome text := btrim(coalesce(p_payload->'dadosPessoais'->>'nome',''));
  _cpf text := regexp_replace(coalesce(p_payload->'dadosPessoais'->>'cpf',''), '\D', '', 'g');
  _telefone text := btrim(coalesce(p_payload->'dadosPessoais'->>'telefone',''));
  _email text := btrim(coalesce(p_payload->'dadosPessoais'->>'email',''));
  _itens jsonb := coalesce(p_payload->'itens', '[]'::jsonb);
  _item jsonb;
  _variante_id uuid;
  _qtd integer;
  _preco numeric;
  _total numeric := 0;
  _pedido_id uuid;
  _existente public.pedidos%ROWTYPE;
  _novo integer;
BEGIN
  IF _idem IS NOT NULL THEN
    SELECT * INTO _existente FROM public.pedidos WHERE idempotency_key = _idem;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'reused', true,
        'pedido_id', _existente.id, 'valor_final', _existente.valor_final,
        'status', _existente.status);
    END IF;
  END IF;

  IF _nome = '' OR length(_cpf) <> 11 OR _telefone = '' OR _email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dados_pessoais_invalidos');
  END IF;

  IF jsonb_array_length(_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'itens_obrigatorios');
  END IF;

  -- validação de itens e cálculo do total (bloqueia as variantes envolvidas)
  FOR _item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _variante_id := nullif(_item->>'variante_id','')::uuid;
    _qtd := coalesce((_item->>'quantidade')::int, 0);
    IF _variante_id IS NULL OR _qtd <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'item_invalido');
    END IF;

    SELECT coalesce(v.preco, pr.preco_base) INTO _preco
    FROM public.produtos_variantes v
    JOIN public.produtos_catalogo pr ON pr.id = v.produto_id
    WHERE v.id = _variante_id
      AND v.ativo = true AND pr.ativo = true
      AND v.estoque_atual >= _qtd
    FOR UPDATE OF v;

    IF _preco IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'estoque_insuficiente',
        'variante_id', _variante_id);
    END IF;

    _total := _total + (_preco * _qtd);
  END LOOP;

  INSERT INTO public.pedidos (aluno_id, nome, cpf, telefone, email, status,
                              valor_total, desconto, valor_final, idempotency_key)
  VALUES (nullif(p_payload->>'aluno_id','')::uuid, _nome, _cpf, _telefone, _email,
          'aguardando_pagamento', _total, 0, _total, _idem)
  RETURNING id INTO _pedido_id;

  -- itens + reserva de estoque (mesma transação: tudo ou nada)
  PERFORM set_config('app.estoque_mov', 'on', true);
  FOR _item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _variante_id := (_item->>'variante_id')::uuid;
    _qtd := (_item->>'quantidade')::int;

    SELECT coalesce(v.preco, pr.preco_base) INTO _preco
    FROM public.produtos_variantes v
    JOIN public.produtos_catalogo pr ON pr.id = v.produto_id
    WHERE v.id = _variante_id;

    INSERT INTO public.pedido_itens (pedido_id, variante_id, quantidade, preco_unitario_snapshot)
    VALUES (_pedido_id, _variante_id, _qtd, _preco);

    UPDATE public.produtos_variantes
      SET estoque_atual = estoque_atual - _qtd
      WHERE id = _variante_id
      RETURNING estoque_atual INTO _novo;

    IF _novo IS NULL OR _novo < 0 THEN
      RAISE EXCEPTION 'estoque_insuficiente';
    END IF;

    INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id)
    VALUES (_variante_id, 'reserva', _qtd,
            'Reserva do pedido ' || _pedido_id::text, _pedido_id);
  END LOOP;
  PERFORM set_config('app.estoque_mov', 'off', true);

  RETURN jsonb_build_object('ok', true, 'reused', false,
    'pedido_id', _pedido_id, 'valor_final', _total, 'status', 'aguardando_pagamento');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_loja_criar_pedido(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loja_criar_pedido(jsonb) TO service_role;

-- 4. devolução do estoque reservado quando o pagamento falha
CREATE OR REPLACE FUNCTION public.fn_loja_reverter_reserva(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r record;
BEGIN
  -- evita devolver duas vezes o mesmo pedido
  IF EXISTS (
    SELECT 1 FROM public.estoque_movimentos
    WHERE pedido_id = p_pedido_id AND tipo = 'cancelamento_reserva'
  ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.estoque_mov', 'on', true);
  FOR _r IN SELECT variante_id, quantidade FROM public.pedido_itens WHERE pedido_id = p_pedido_id LOOP
    UPDATE public.produtos_variantes
      SET estoque_atual = estoque_atual + _r.quantidade
      WHERE id = _r.variante_id;

    INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id)
    VALUES (_r.variante_id, 'cancelamento_reserva', _r.quantidade,
            'Estorno da reserva do pedido ' || p_pedido_id::text, p_pedido_id);
  END LOOP;
  PERFORM set_config('app.estoque_mov', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_loja_reverter_reserva(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loja_reverter_reserva(uuid) TO service_role;