-- Reserva atômica do estorno: trava a linha da cobrança, valida o saldo no servidor
-- e cria a reserva (status 'refund_pending'). Nada é considerado estornado aqui.
CREATE OR REPLACE FUNCTION public.fn_estorno_reservar(
  _cobranca_id uuid,
  _idempotency_key text,
  _valor numeric,
  _user_id uuid
)
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

  -- Requisição repetida (duplo clique): devolve a reserva/estorno já existente.
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
   WHERE pr.tid = c.tid
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
    (tid, amount, installments, kind, status, cobranca_id, venda_id, created_by, idempotency_key)
  VALUES
    (c.tid, v_cents, 1, 'refund', 'refund_pending', c.id, v_venda_id, _user_id, _idempotency_key)
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

-- Confirmação: só é chamada DEPOIS do "ok" da Rede.
CREATE OR REPLACE FUNCTION public.fn_estorno_confirmar(
  _pagamento_id uuid,
  _motivo text,
  _user_id uuid,
  _nsu text,
  _authorization_code text,
  _return_code text,
  _return_message text,
  _raw jsonb
)
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
         raw_response = _raw
   WHERE id = _pagamento_id;

  SELECT * INTO c FROM public.cobrancas WHERE id = p.cobranca_id FOR UPDATE;

  SELECT coalesce(sum(pr.amount), 0)::numeric / 100 INTO v_total
    FROM public.pagamentos_rede pr
   WHERE pr.tid = p.tid AND pr.kind = 'refund' AND pr.status = 'refunded';

  v_integral := round(v_total, 2) >= round(c.valor, 2);

  IF v_integral THEN
    UPDATE public.cobrancas SET status = 'estornado' WHERE id = c.id;
    IF p.venda_id IS NOT NULL THEN
      UPDATE public.vendas SET status_pagamento = 'estornado' WHERE id = p.venda_id;
    END IF;
    UPDATE public.inadimplencias
       SET status = 'cancelada'
     WHERE cobranca_id = c.id AND status = 'aberta';
  END IF;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES (
    'cobrancas',
    c.id::text,
    'estorno',
    _user_id,
    jsonb_build_object('status', c.status, 'valor', c.valor, 'tid', p.tid),
    jsonb_build_object(
      'status', CASE WHEN v_integral THEN 'estornado' ELSE c.status END,
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

  RETURN jsonb_build_object(
    'ok', true,
    'integral', v_integral,
    'valor_estornado', p.amount::numeric / 100,
    'total_estornado', v_total,
    'valor_pago', c.valor,
    'saldo_restante', greatest(round(c.valor - v_total, 2), 0),
    'cobranca_status', CASE WHEN v_integral THEN 'estornado' ELSE c.status END
  );
END;
$function$;

-- Cancelamento da reserva quando a Rede recusa ou há erro de comunicação:
-- remove a reserva para que nada fique registrado como estorno.
CREATE OR REPLACE FUNCTION public.fn_estorno_cancelar_reserva(_pagamento_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.pagamentos_rede
   WHERE id = _pagamento_id AND status = 'refund_pending';
$function$;

REVOKE ALL ON FUNCTION public.fn_estorno_reservar(uuid, text, numeric, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_estorno_confirmar(uuid, text, uuid, text, text, text, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_estorno_cancelar_reserva(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estorno_reservar(uuid, text, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_estorno_confirmar(uuid, text, uuid, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_estorno_cancelar_reserva(uuid) TO service_role;