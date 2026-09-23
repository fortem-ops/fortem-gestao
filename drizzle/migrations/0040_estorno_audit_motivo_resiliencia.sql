-- 1) Amplia o CHECK de audit_log.operacao para aceitar 'estorno', preservando todos os valores atuais.
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_operacao_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_operacao_check CHECK (
  operacao = ANY (ARRAY[
    'insert','update','delete',
    'REVEAL_CPF','REVEAL_CPF_SERVICE','EDIT_CPF',
    'login_sucesso','login_falha','login_bloqueado',
    'cron_alertas_diarios','cron_alertas_diarios_noop',
    'lgpd_relatorio','lgpd_anonimizacao',
    'estorno'
  ])
);

-- 2) Motivo do estorno gravado no próprio registro do pagamento.
ALTER TABLE public.pagamentos_rede ADD COLUMN IF NOT EXISTS motivo_estorno text;
COMMENT ON COLUMN public.pagamentos_rede.motivo_estorno IS 'Motivo informado pelo admin no estorno (kind=refund). Fonte do comprovante; audit_log e trilha extra.';

-- 3) Confirmação resiliente: o audit_log nunca pode impedir o registro do estorno já feito na Rede.
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
   WHERE pr.tid = p.tid AND pr.kind = 'refund' AND pr.status = 'refunded';

  v_integral := round(v_total, 2) >= round(c.valor, 2);

  IF v_integral THEN
    UPDATE public.cobrancas SET status = 'estornado' WHERE id = c.id;
    -- Só a venda vinculada A ESTA cobrança (vendas.cobranca_id) é estornada.
    -- Cobranças de recorrência normalmente não têm venda vinculada: nesse caso
    -- nenhuma venda é tocada, para nunca estornar a venda do contrato inteiro.
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

-- 4) Saldo estornável: fora do alcance de visitantes não autenticados.
REVOKE ALL ON FUNCTION public.fn_cobranca_saldo_estornavel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_cobranca_saldo_estornavel(uuid) TO authenticated, service_role;