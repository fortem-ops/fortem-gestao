CREATE OR REPLACE FUNCTION public.fn_cleanup_on_venda_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _contrato_ids uuid[];
  _vendas_rest int;
  _contratos_rest int;
BEGIN
  DELETE FROM public.creditos_aluno WHERE origem_id = OLD.id;

  IF OLD.plano_id IS NOT NULL THEN
    SELECT array_agg(id) INTO _contrato_ids
    FROM public.contratos WHERE plano_id = OLD.plano_id;

    IF _contrato_ids IS NOT NULL AND array_length(_contrato_ids, 1) > 0 THEN
      DELETE FROM public.contratos_documentos WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.inadimplencias WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.ciclos_credito  WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.cobrancas       WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.contratos       WHERE id           = ANY(_contrato_ids);
    END IF;
  END IF;

  DELETE FROM public.pagamentos_rede   WHERE venda_id  = OLD.id;
  DELETE FROM public.comissionamentos  WHERE origem_id = OLD.id;

  -- Cobrança vinculada diretamente à venda: remove somente se ainda em aberto
  IF OLD.cobranca_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.cobrancas c
                 WHERE c.id = OLD.cobranca_id AND c.status IN ('pendente','atrasado'))
     AND NOT EXISTS (SELECT 1 FROM public.pagamentos_rede p WHERE p.cobranca_id = OLD.cobranca_id)
     AND NOT EXISTS (SELECT 1 FROM public.vendas v WHERE v.cobranca_id = OLD.cobranca_id AND v.id <> OLD.id)
  THEN
    DELETE FROM public.inadimplencias WHERE cobranca_id = OLD.cobranca_id;
    UPDATE public.ciclos_credito SET cobranca_id = NULL WHERE cobranca_id = OLD.cobranca_id;
    DELETE FROM public.cobrancas WHERE id = OLD.cobranca_id AND status IN ('pendente','atrasado');
  END IF;

  IF OLD.plano_id IS NOT NULL THEN
    SELECT count(*) INTO _vendas_rest
    FROM public.vendas WHERE plano_id = OLD.plano_id AND id <> OLD.id;
    SELECT count(*) INTO _contratos_rest
    FROM public.contratos WHERE plano_id = OLD.plano_id;
    IF _vendas_rest = 0 AND _contratos_rest = 0 THEN
      UPDATE public.planos SET ativo = false WHERE id = OLD.plano_id;
    END IF;
  END IF;

  RETURN OLD;
END $function$;