ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS entregue_por uuid NULL,
  ADD COLUMN IF NOT EXISTS variante_entregue_id uuid NULL REFERENCES public.produtos_variantes(id);

CREATE OR REPLACE FUNCTION public.fn_loja_item_eh_encomenda(p_pedido_id uuid, p_variante_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.estoque_movimentos m
    WHERE m.tipo = 'encomenda' AND m.pedido_id = p_pedido_id AND m.variante_id = p_variante_id);
$$;
REVOKE ALL ON FUNCTION public.fn_loja_item_eh_encomenda(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_loja_encomendado_pendente(p_variante_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(i.quantidade), 0)::int
  FROM public.pedido_itens i
  JOIN public.pedidos p ON p.id = i.pedido_id
  WHERE i.variante_id = p_variante_id AND p.status = 'pago' AND i.entregue_em IS NULL
    AND public.fn_loja_item_eh_encomenda(i.pedido_id, i.variante_id);
$$;
REVOKE ALL ON FUNCTION public.fn_loja_encomendado_pendente(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_loja_estoque_disponivel(p_produto_ids uuid[] DEFAULT NULL)
RETURNS TABLE (variante_id uuid, produto_id uuid, estoque_fisico integer, encomendado_pendente integer, disponivel integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pend AS (
    SELECT i.variante_id, sum(i.quantidade)::int AS qtd
    FROM public.pedido_itens i
    JOIN public.pedidos p ON p.id = i.pedido_id
    WHERE p.status = 'pago' AND i.entregue_em IS NULL
      AND EXISTS (SELECT 1 FROM public.estoque_movimentos m
        WHERE m.tipo = 'encomenda' AND m.pedido_id = i.pedido_id AND m.variante_id = i.variante_id)
    GROUP BY i.variante_id
  )
  SELECT v.id, v.produto_id, coalesce(v.estoque_atual, 0),
         coalesce(pend.qtd, 0),
         greatest(coalesce(v.estoque_atual, 0) - coalesce(pend.qtd, 0), 0)
  FROM public.produtos_variantes v
  JOIN public.produtos_catalogo pr ON pr.id = v.produto_id
  LEFT JOIN pend ON pend.variante_id = v.id
  WHERE v.ativo = true AND pr.ativo = true
    AND (p_produto_ids IS NULL OR v.produto_id = ANY(p_produto_ids));
$$;
REVOKE ALL ON FUNCTION public.fn_loja_estoque_disponivel(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_loja_estoque_disponivel(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_loja_entregar_item(p_item_id uuid, p_variante_entregue_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _item public.pedido_itens%ROWTYPE;
  _pedido public.pedidos%ROWTYPE;
  _orig public.produtos_variantes%ROWTYPE;
  _ent public.produtos_variantes%ROWTYPE;
  _encomenda boolean;
  _novo integer;
  _motivo text;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO _item FROM public.pedido_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado'; END IF;
  SELECT * INTO _pedido FROM public.pedidos WHERE id = _item.pedido_id FOR UPDATE;
  IF _pedido.status <> 'pago' THEN RAISE EXCEPTION 'pedido_nao_pago'; END IF;
  IF _item.entregue_em IS NOT NULL THEN RAISE EXCEPTION 'item_ja_entregue'; END IF;

  _encomenda := public.fn_loja_item_eh_encomenda(_item.pedido_id, _item.variante_id);
  SELECT * INTO _orig FROM public.produtos_variantes WHERE id = _item.variante_id;

  IF p_variante_entregue_id IS NOT NULL AND p_variante_entregue_id <> _item.variante_id THEN
    IF NOT _encomenda THEN RAISE EXCEPTION 'troca_nao_permitida'; END IF;
    SELECT * INTO _ent FROM public.produtos_variantes WHERE id = p_variante_entregue_id FOR UPDATE;
    IF NOT FOUND OR _ent.produto_id <> _orig.produto_id
       OR coalesce(_ent.cor, '') <> coalesce(_orig.cor, '') THEN
      RAISE EXCEPTION 'troca_invalida';
    END IF;
  ELSE
    SELECT * INTO _ent FROM public.produtos_variantes WHERE id = _item.variante_id FOR UPDATE;
  END IF;

  IF _encomenda THEN
    _motivo := 'Entrega encomenda pedido ' || _pedido.id::text;
    IF _ent.id <> _orig.id THEN
      _motivo := _motivo || ' — troca ' || coalesce(_orig.tamanho, '-') || ' → ' || coalesce(_ent.tamanho, '-');
    END IF;
    PERFORM set_config('app.estoque_mov', 'on', true);
    UPDATE public.produtos_variantes SET estoque_atual = estoque_atual - _item.quantidade
      WHERE id = _ent.id RETURNING estoque_atual INTO _novo;
    IF _novo IS NULL OR _novo < 0 THEN RAISE EXCEPTION 'estoque_insuficiente'; END IF;
    INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id, created_by)
    VALUES (_ent.id, 'saida', _item.quantidade, _motivo, _pedido.id, auth.uid());
    PERFORM set_config('app.estoque_mov', 'off', true);
  ELSE
    _novo := _ent.estoque_atual;
  END IF;

  UPDATE public.pedido_itens SET entregue_em = now(), entregue_por = auth.uid(), variante_entregue_id = _ent.id
    WHERE id = _item.id;

  IF NOT EXISTS (SELECT 1 FROM public.pedido_itens WHERE pedido_id = _pedido.id AND entregue_em IS NULL) THEN
    UPDATE public.pedidos SET retirado_em = now() WHERE id = _pedido.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'estoque_restante', _novo);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_loja_entregar_item(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_loja_entregar_item(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_loja_desfazer_entrega(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _item public.pedido_itens%ROWTYPE;
  _novo integer;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO _item FROM public.pedido_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_nao_encontrado'; END IF;
  IF _item.entregue_em IS NULL THEN RAISE EXCEPTION 'item_nao_entregue'; END IF;

  IF public.fn_loja_item_eh_encomenda(_item.pedido_id, _item.variante_id) THEN
    PERFORM set_config('app.estoque_mov', 'on', true);
    UPDATE public.produtos_variantes SET estoque_atual = estoque_atual + _item.quantidade
      WHERE id = coalesce(_item.variante_entregue_id, _item.variante_id) RETURNING estoque_atual INTO _novo;
    INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id, created_by)
    VALUES (coalesce(_item.variante_entregue_id, _item.variante_id), 'entrada', _item.quantidade,
      'Desfeita entrega pedido ' || _item.pedido_id::text, _item.pedido_id, auth.uid());
    PERFORM set_config('app.estoque_mov', 'off', true);
  END IF;

  UPDATE public.pedido_itens SET entregue_em = NULL, entregue_por = NULL, variante_entregue_id = NULL
    WHERE id = _item.id;
  UPDATE public.pedidos SET retirado_em = NULL WHERE id = _item.pedido_id;

  RETURN jsonb_build_object('ok', true, 'estoque_restante', _novo);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_loja_desfazer_entrega(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_loja_desfazer_entrega(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_loja_criar_pedido(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _idem text := nullif(btrim(coalesce(p_payload->>'idempotency_key','')), '');
  _nome text := btrim(coalesce(p_payload->'dadosPessoais'->>'nome',''));
  _cpf text := regexp_replace(coalesce(p_payload->'dadosPessoais'->>'cpf',''), '\D', '', 'g');
  _telefone text := btrim(coalesce(p_payload->'dadosPessoais'->>'telefone',''));
  _email text := btrim(coalesce(p_payload->'dadosPessoais'->>'email',''));
  _codigo text := upper(btrim(coalesce(p_payload->>'cupom_codigo','')));
  _itens jsonb := coalesce(p_payload->'itens', '[]'::jsonb);
  _item jsonb;
  _variante_id uuid;
  _qtd integer;
  _preco numeric;
  _estoque integer;
  _disponivel integer;
  _permite boolean;
  _total numeric := 0;
  _desconto numeric := 0;
  _valor_final numeric := 0;
  _promocao public.promocoes%ROWTYPE;
  _promocao_id uuid;
  _pedido_id uuid;
  _existente public.pedidos%ROWTYPE;
  _novo integer;
  _eh_encomenda boolean := false;
  _item_encomenda boolean;
  _status text := 'aguardando_pagamento';
BEGIN
  IF _idem IS NOT NULL THEN
    SELECT * INTO _existente FROM public.pedidos WHERE idempotency_key = _idem;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'reused', true,
        'pedido_id', _existente.id, 'valor_final', _existente.valor_final,
        'desconto', _existente.desconto, 'status', _existente.status,
        'eh_encomenda', _existente.eh_encomenda);
    END IF;
  END IF;

  IF _nome = '' OR length(_cpf) <> 11 OR _telefone = '' OR _email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dados_pessoais_invalidos');
  END IF;
  IF jsonb_array_length(_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'itens_obrigatorios');
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _variante_id := nullif(_item->>'variante_id','')::uuid;
    _qtd := coalesce((_item->>'quantidade')::int, 0);
    IF _variante_id IS NULL OR _qtd <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'item_invalido');
    END IF;
    SELECT coalesce(v.preco, pr.preco_base), v.estoque_atual, pr.permite_encomenda
      INTO _preco, _estoque, _permite
    FROM public.produtos_variantes v
    JOIN public.produtos_catalogo pr ON pr.id = v.produto_id
    WHERE v.id = _variante_id AND v.ativo = true AND pr.ativo = true
    FOR UPDATE OF v;
    _disponivel := coalesce(_estoque, 0) - public.fn_loja_encomendado_pendente(_variante_id);
    IF _preco IS NULL OR (_disponivel < _qtd AND coalesce(_permite, false) = false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'estoque_insuficiente', 'variante_id', _variante_id);
    END IF;
    _total := _total + (_preco * _qtd);
  END LOOP;

  IF _codigo <> '' THEN
    SELECT * INTO _promocao FROM public.promocoes
    WHERE upper(codigo) = _codigo
    FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_invalido'); END IF;
    IF NOT _promocao.ativo THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_inativo'); END IF;
    IF _promocao.valido_de IS NOT NULL AND now() < _promocao.valido_de THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_ainda_nao_valido'); END IF;
    IF _promocao.valido_ate IS NOT NULL AND now() > _promocao.valido_ate THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_expirado'); END IF;
    IF _promocao.uso_maximo IS NOT NULL AND _promocao.uso_atual >= _promocao.uso_maximo THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_esgotado'); END IF;
    _desconto := CASE WHEN _promocao.tipo = 'percentual'
      THEN round(_total * least(greatest(_promocao.valor, 0), 100) / 100, 2)
      ELSE least(greatest(_promocao.valor, 0), _total)
    END;
    _promocao_id := _promocao.id;
  END IF;

  _valor_final := greatest(_total - _desconto, 0);
  IF _valor_final = 0 THEN _status := 'pago'; END IF;

  INSERT INTO public.pedidos (aluno_id, nome, cpf, telefone, email, status,
    valor_total, desconto, valor_final, promocao_id, forma_pagamento, idempotency_key)
  VALUES (nullif(p_payload->>'aluno_id','')::uuid, _nome, _cpf, _telefone, _email,
    _status, _total, _desconto, _valor_final, _promocao_id,
    CASE WHEN _valor_final = 0 THEN 'cupom' ELSE NULL END, _idem)
  RETURNING id INTO _pedido_id;

  PERFORM set_config('app.estoque_mov', 'on', true);
  FOR _item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _variante_id := (_item->>'variante_id')::uuid;
    _qtd := (_item->>'quantidade')::int;
    SELECT coalesce(v.preco, pr.preco_base), v.estoque_atual, pr.permite_encomenda
      INTO _preco, _estoque, _permite
    FROM public.produtos_variantes v
    JOIN public.produtos_catalogo pr ON pr.id = v.produto_id WHERE v.id = _variante_id;
    _disponivel := coalesce(_estoque, 0) - public.fn_loja_encomendado_pendente(_variante_id);
    INSERT INTO public.pedido_itens (pedido_id, variante_id, quantidade, preco_unitario_snapshot)
    VALUES (_pedido_id, _variante_id, _qtd, _preco);
    _item_encomenda := (_disponivel < _qtd);
    IF _item_encomenda THEN
      IF coalesce(_permite, false) = false THEN RAISE EXCEPTION 'estoque_insuficiente'; END IF;
      _eh_encomenda := true;
      INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id)
      VALUES (_variante_id, 'encomenda', _qtd, 'Encomenda do pedido ' || _pedido_id::text, _pedido_id);
    ELSE
      UPDATE public.produtos_variantes SET estoque_atual = estoque_atual - _qtd
      WHERE id = _variante_id RETURNING estoque_atual INTO _novo;
      IF _novo IS NULL OR _novo < 0 THEN RAISE EXCEPTION 'estoque_insuficiente'; END IF;
      INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id)
      VALUES (_variante_id, 'reserva', _qtd, 'Reserva do pedido ' || _pedido_id::text, _pedido_id);
    END IF;
  END LOOP;
  PERFORM set_config('app.estoque_mov', 'off', true);

  IF _eh_encomenda THEN UPDATE public.pedidos SET eh_encomenda = true WHERE id = _pedido_id; END IF;

  RETURN jsonb_build_object('ok', true, 'reused', false,
    'pedido_id', _pedido_id, 'valor_final', _valor_final, 'desconto', _desconto,
    'status', _status, 'eh_encomenda', _eh_encomenda);
END;
$function$;