CREATE OR REPLACE FUNCTION public.fn_loja_venda_balcao(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _idem text := nullif(btrim(coalesce(p_payload->>'idempotency_key','')), '');
  _aluno_id uuid := nullif(p_payload->>'aluno_id','')::uuid;
  _itens jsonb := coalesce(p_payload->'itens', '[]'::jsonb);
  _codigo text := upper(btrim(coalesce(p_payload->>'cupom_codigo','')));
  _desc_tipo text := coalesce(p_payload->>'desconto_tipo', 'valor');
  _desc_in numeric := greatest(coalesce((p_payload->>'desconto_valor')::numeric, 0), 0);
  _forma text := nullif(btrim(coalesce(p_payload->>'forma_pagamento','')), '');
  _pago boolean := coalesce((p_payload->>'pago')::boolean, false);
  _a record; _cpf text; _item jsonb; _variante_id uuid; _qtd int; _preco numeric;
  _estoque int; _disponivel int; _permite boolean; _total numeric := 0; _desconto numeric := 0;
  _valor_final numeric; _promocao public.promocoes%ROWTYPE; _promocao_id uuid;
  _pedido_id uuid; _existente public.pedidos%ROWTYPE; _novo int; _eh_encomenda boolean := false;
  _item_id uuid; _status text;
BEGIN
  IF _uid IS NULL OR NOT public.is_coordinator_or_admin(_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sem_permissao');
  END IF;
  IF _idem IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'idempotency_obrigatoria'); END IF;
  SELECT * INTO _existente FROM public.pedidos WHERE idempotency_key = _idem;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reused', true, 'pedido_id', _existente.id,
      'valor_final', _existente.valor_final, 'status', _existente.status, 'eh_encomenda', _existente.eh_encomenda);
  END IF;
  IF _forma IS NULL AND _pago THEN RETURN jsonb_build_object('ok', false, 'error', 'forma_obrigatoria'); END IF;
  IF jsonb_array_length(_itens) = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'itens_obrigatorios'); END IF;

  SELECT id, nome, email, telefone INTO _a FROM public.alunos WHERE id = _aluno_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'aluno_nao_encontrado'); END IF;
  _cpf := regexp_replace(coalesce(public.fn_reveal_cpf(_aluno_id), ''), '\D', '', 'g');

  FOR _item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _variante_id := nullif(_item->>'variante_id','')::uuid;
    _qtd := coalesce((_item->>'quantidade')::int, 0);
    IF _variante_id IS NULL OR _qtd <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'item_invalido'); END IF;
    SELECT coalesce(v.preco, pr.preco_base), v.estoque_atual, pr.permite_encomenda INTO _preco, _estoque, _permite
      FROM public.produtos_variantes v JOIN public.produtos_catalogo pr ON pr.id = v.produto_id
     WHERE v.id = _variante_id AND v.ativo AND pr.ativo FOR UPDATE OF v;
    _disponivel := coalesce(_estoque, 0) - public.fn_loja_encomendado_pendente(_variante_id);
    IF _preco IS NULL OR (_disponivel < _qtd AND NOT coalesce(_permite, false)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'estoque_insuficiente', 'variante_id', _variante_id);
    END IF;
    _total := _total + _preco * _qtd;
  END LOOP;

  IF _codigo <> '' THEN
    SELECT * INTO _promocao FROM public.promocoes WHERE upper(codigo) = _codigo FOR UPDATE;
    IF NOT FOUND OR NOT _promocao.ativo
       OR (_promocao.valido_de IS NOT NULL AND now() < _promocao.valido_de)
       OR (_promocao.valido_ate IS NOT NULL AND now() > _promocao.valido_ate)
       OR (_promocao.uso_maximo IS NOT NULL AND _promocao.uso_atual >= _promocao.uso_maximo) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cupom_invalido');
    END IF;
    _desconto := CASE WHEN _promocao.tipo = 'percentual'
      THEN round(_total * least(greatest(_promocao.valor, 0), 100) / 100, 2)
      ELSE least(greatest(_promocao.valor, 0), _total) END;
    _promocao_id := _promocao.id;
  ELSE
    _desconto := CASE WHEN _desc_tipo = 'percentual' THEN round(_total * least(_desc_in, 100) / 100, 2)
                      ELSE least(_desc_in, _total) END;
  END IF;
  _valor_final := greatest(_total - _desconto, 0);
  _status := CASE WHEN _pago OR _valor_final = 0 THEN 'pago' ELSE 'aguardando_pagamento' END;

  INSERT INTO public.pedidos (aluno_id, nome, cpf, telefone, email, status, valor_total, desconto, valor_final,
    promocao_id, forma_pagamento, idempotency_key)
  VALUES (_aluno_id, _a.nome, _cpf, coalesce(_a.telefone, ''), coalesce(_a.email, ''), _status,
    _total, _desconto, _valor_final, _promocao_id, _forma, _idem)
  RETURNING id INTO _pedido_id;

  PERFORM set_config('app.estoque_mov', 'on', true);
  FOR _item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _variante_id := (_item->>'variante_id')::uuid; _qtd := (_item->>'quantidade')::int;
    SELECT coalesce(v.preco, pr.preco_base), v.estoque_atual INTO _preco, _estoque
      FROM public.produtos_variantes v JOIN public.produtos_catalogo pr ON pr.id = v.produto_id WHERE v.id = _variante_id;
    _disponivel := coalesce(_estoque, 0) - public.fn_loja_encomendado_pendente(_variante_id);
    INSERT INTO public.pedido_itens (pedido_id, variante_id, quantidade, preco_unitario_snapshot)
    VALUES (_pedido_id, _variante_id, _qtd, _preco) RETURNING id INTO _item_id;
    IF _disponivel < _qtd THEN
      _eh_encomenda := true;
      INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id, created_by)
      VALUES (_variante_id, 'encomenda', _qtd, 'Encomenda (venda balcão) ' || _pedido_id::text, _pedido_id, _uid);
    ELSE
      UPDATE public.produtos_variantes SET estoque_atual = estoque_atual - _qtd WHERE id = _variante_id
        RETURNING estoque_atual INTO _novo;
      IF _novo IS NULL OR _novo < 0 THEN RAISE EXCEPTION 'estoque_insuficiente'; END IF;
      INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id, created_by)
      VALUES (_variante_id, 'reserva', _qtd, 'Venda balcão ' || _pedido_id::text, _pedido_id, _uid);
      UPDATE public.pedido_itens SET entregue_em = now(), entregue_por = _uid WHERE id = _item_id;
    END IF;
  END LOOP;
  PERFORM set_config('app.estoque_mov', 'off', true);

  UPDATE public.pedidos SET eh_encomenda = _eh_encomenda,
    retirado_em = CASE WHEN _eh_encomenda THEN NULL ELSE now() END WHERE id = _pedido_id;

  RETURN jsonb_build_object('ok', true, 'reused', false, 'pedido_id', _pedido_id, 'valor_final', _valor_final,
    'desconto', _desconto, 'status', _status, 'eh_encomenda', _eh_encomenda, 'tem_cpf', length(_cpf) = 11);
END $function$;