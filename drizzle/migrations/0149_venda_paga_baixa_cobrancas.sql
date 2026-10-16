CREATE OR REPLACE FUNCTION public.fn_venda_paga_baixa_cobrancas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _contrato uuid; _ids uuid[];
BEGIN
  IF NEW.status_pagamento IS DISTINCT FROM 'pago' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status_pagamento = 'pago' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.modalidade_pagamento,'') NOT IN ('cartao_parcelado','cartao_credito','pix_avista','dinheiro') THEN RETURN NEW; END IF;

  IF NEW.cobranca_id IS NOT NULL THEN
    SELECT contrato_id INTO _contrato FROM public.cobrancas WHERE id = NEW.cobranca_id;
  END IF;
  IF _contrato IS NULL AND NEW.plano_id IS NOT NULL THEN
    SELECT id INTO _contrato FROM public.contratos WHERE aluno_id = NEW.aluno_id AND plano_id = NEW.plano_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF _contrato IS NULL THEN RETURN NEW; END IF;

  WITH u AS (
    UPDATE public.cobrancas SET status='pago', data_pagamento = COALESCE(NEW.data_venda, CURRENT_DATE)
    WHERE contrato_id = _contrato AND status IN ('pendente','atrasado') AND numero_ciclo <> 999
    RETURNING id)
  SELECT array_agg(id) INTO _ids FROM u;

  IF _ids IS NOT NULL THEN
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload, user_id)
    VALUES ('cobrancas','baixa_venda_paga','Parcelas baixadas por venda paga (parcelado/à vista)',
      jsonb_build_object('venda_id',NEW.id,'contrato_id',_contrato,'cobrancas',to_jsonb(_ids)), auth.uid());
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_venda_paga_baixa_cobrancas ON public.vendas;
CREATE TRIGGER trg_venda_paga_baixa_cobrancas AFTER INSERT OR UPDATE OF status_pagamento ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.fn_venda_paga_baixa_cobrancas();