-- Encerra ciclos de crédito que permaneceram ativos em contratos já cancelados
UPDATE public.ciclos_credito ci
SET status = 'cancelado'
FROM public.contratos c
WHERE ci.contrato_id = c.id
  AND ci.status = 'ativo'
  AND c.status = 'cancelado';

-- Garante que cancelar um contrato sempre encerre seus ciclos de crédito ativos
CREATE OR REPLACE FUNCTION public.fn_contratos_cancelar_ciclos_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado' THEN
    UPDATE public.ciclos_credito
    SET status = 'cancelado'
    WHERE contrato_id = NEW.id
      AND status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_contratos_cancelar_ciclos_credito() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contratos_cancelar_ciclos_credito ON public.contratos;
CREATE TRIGGER trg_contratos_cancelar_ciclos_credito
  AFTER UPDATE OF status ON public.contratos
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado')
  EXECUTE FUNCTION public.fn_contratos_cancelar_ciclos_credito();