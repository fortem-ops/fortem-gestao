-- 1) Permite que as funções de checagem de papel sejam avaliadas sob o papel anon
--    (políticas RLS com role "public" referenciam is_staff/is_coordinator_or_admin e
--     falhavam com 42501 antes mesmo de avaliar a política).
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_coordinator_or_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;

-- 2) Cupom: contabilizar uso somente quando o pedido é efetivamente pago
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
    IF _preco IS NULL OR (_estoque < _qtd AND coalesce(_permite, false) = false) THEN
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
    -- uso_atual passa a ser contabilizado pelo trigger de pagamento (trg_pedidos_uso_cupom)
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
    INSERT INTO public.pedido_itens (pedido_id, variante_id, quantidade, preco_unitario_snapshot)
    VALUES (_pedido_id, _variante_id, _qtd, _preco);
    _item_encomenda := (_estoque < _qtd);
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

CREATE OR REPLACE FUNCTION public.fn_pedidos_uso_cupom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.promocao_id IS NOT NULL AND NEW.status = 'pago' THEN
      UPDATE public.promocoes SET uso_atual = uso_atual + 1 WHERE id = NEW.promocao_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.promocao_id IS NOT NULL THEN
    IF NEW.status = 'pago' AND coalesce(OLD.status, '') <> 'pago' THEN
      UPDATE public.promocoes SET uso_atual = uso_atual + 1 WHERE id = NEW.promocao_id;
    ELSIF coalesce(OLD.status, '') = 'pago' AND NEW.status <> 'pago' THEN
      UPDATE public.promocoes SET uso_atual = GREATEST(0, uso_atual - 1) WHERE id = NEW.promocao_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_uso_cupom ON public.pedidos;
CREATE TRIGGER trg_pedidos_uso_cupom
AFTER INSERT OR UPDATE OF status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_pedidos_uso_cupom();

-- exclusão administrativa: só devolve uso se o pedido estava pago
CREATE OR REPLACE FUNCTION public.fn_loja_excluir_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pedido public.pedidos%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sem_permissao');
  END IF;

  SELECT * INTO _pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pedido_nao_encontrado');
  END IF;

  IF _pedido.retirado_em IS NULL THEN
    PERFORM public.fn_loja_reverter_reserva(p_pedido_id);
  END IF;

  IF _pedido.promocao_id IS NOT NULL AND _pedido.status = 'pago' THEN
    UPDATE public.promocoes
      SET uso_atual = GREATEST(0, uso_atual - 1)
      WHERE id = _pedido.promocao_id;
  END IF;

  DELETE FROM public.pagamentos_rede WHERE pedido_id = p_pedido_id;
  DELETE FROM public.pix_cobrancas WHERE pedido_id = p_pedido_id;
  UPDATE public.estoque_movimentos SET pedido_id = NULL WHERE pedido_id = p_pedido_id;

  DELETE FROM public.pedidos WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'pedido_id', p_pedido_id);
END;
$$;
