CREATE TABLE public.produtos_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos_catalogo(id) ON DELETE CASCADE,
  cor text,
  imagem_url text NOT NULL,
  legenda text,
  ordem integer NOT NULL DEFAULT 0,
  principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_produtos_imagens_produto_cor_ordem
  ON public.produtos_imagens(produto_id, cor, ordem, created_at);
CREATE UNIQUE INDEX uq_produtos_imagens_principal_geral
  ON public.produtos_imagens(produto_id) WHERE principal = true AND cor IS NULL;
CREATE UNIQUE INDEX uq_produtos_imagens_principal_cor
  ON public.produtos_imagens(produto_id, lower(cor)) WHERE principal = true AND cor IS NOT NULL;

GRANT SELECT ON public.produtos_imagens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_imagens TO authenticated;
GRANT ALL ON public.produtos_imagens TO service_role;

ALTER TABLE public.produtos_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_imagens_public_read_ativos" ON public.produtos_imagens
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.produtos_catalogo p
    WHERE p.id = produto_id AND p.ativo = true
  ));

CREATE POLICY "produtos_imagens_admin_read" ON public.produtos_imagens
  FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "produtos_imagens_admin_write" ON public.produtos_imagens
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_produtos_imagens_updated_at
  BEFORE UPDATE ON public.produtos_imagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.produtos_imagens (produto_id, imagem_url, legenda, ordem, principal)
SELECT id, imagem_url, 'Principal', 10, true
FROM public.produtos_catalogo
WHERE imagem_url IS NOT NULL AND btrim(imagem_url) <> ''
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_loja_validar_cupom(p_codigo text, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p public.promocoes%ROWTYPE;
  _subtotal numeric := greatest(coalesce(p_subtotal, 0), 0);
  _desconto numeric;
BEGIN
  SELECT * INTO _p
  FROM public.promocoes
  WHERE upper(codigo) = upper(btrim(coalesce(p_codigo, '')))
  LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_invalido'); END IF;
  IF NOT _p.ativo THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_inativo'); END IF;
  IF _p.valido_de IS NOT NULL AND now() < _p.valido_de THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_ainda_nao_valido'); END IF;
  IF _p.valido_ate IS NOT NULL AND now() > _p.valido_ate THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_expirado'); END IF;
  IF _p.uso_maximo IS NOT NULL AND _p.uso_atual >= _p.uso_maximo THEN RETURN jsonb_build_object('ok', false, 'error', 'cupom_esgotado'); END IF;

  _desconto := CASE WHEN _p.tipo = 'percentual'
    THEN round(_subtotal * least(greatest(_p.valor, 0), 100) / 100, 2)
    ELSE least(greatest(_p.valor, 0), _subtotal)
  END;

  RETURN jsonb_build_object(
    'ok', true, 'codigo', upper(_p.codigo), 'promocao_id', _p.id,
    'tipo', _p.tipo, 'valor', _p.valor, 'desconto', _desconto,
    'valor_final', greatest(_subtotal - _desconto, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_loja_validar_cupom(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loja_validar_cupom(text, numeric) TO service_role;

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
    UPDATE public.promocoes SET uso_atual = uso_atual + 1 WHERE id = _promocao.id;
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

REVOKE EXECUTE ON FUNCTION public.fn_loja_criar_pedido(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loja_criar_pedido(jsonb) TO service_role;