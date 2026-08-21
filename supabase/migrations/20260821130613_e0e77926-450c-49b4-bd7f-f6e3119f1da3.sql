CREATE OR REPLACE FUNCTION public.fn_cancelar_inadimplencias_contratos_anteriores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato_novo public.contratos%ROWTYPE;
  v_cobrancas_canceladas uuid[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago'
     OR OLD.status IS NOT DISTINCT FROM 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_contrato_novo
    FROM public.contratos
   WHERE id = NEW.contrato_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  WITH elegiveis AS (
    SELECT c_ant.id
      FROM public.cobrancas c_ant
      JOIN public.contratos con_ant
        ON con_ant.id = c_ant.contrato_id
      JOIN public.inadimplencias i
        ON i.cobranca_id = c_ant.id
       AND i.status = 'aberta'
     WHERE con_ant.aluno_id = v_contrato_novo.aluno_id
       AND con_ant.plano_tipo = v_contrato_novo.plano_tipo
       AND con_ant.id <> v_contrato_novo.id
       AND con_ant.data_inicio < v_contrato_novo.data_inicio
       AND con_ant.status IN ('encerrado', 'cancelado')
       AND c_ant.status = 'atrasado'
  ), canceladas AS (
    UPDATE public.cobrancas c
       SET status = 'cancelado'
      FROM elegiveis e
     WHERE c.id = e.id
    RETURNING c.id
  )
  SELECT array_agg(id)
    INTO v_cobrancas_canceladas
    FROM canceladas;

  IF v_cobrancas_canceladas IS NOT NULL THEN
    UPDATE public.inadimplencias
       SET status = 'cancelada',
           data_regularizacao = COALESCE(NEW.data_pagamento, CURRENT_DATE)
     WHERE cobranca_id = ANY(v_cobrancas_canceladas)
       AND status = 'aberta';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cancelar_inadimplencias_contratos_anteriores() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cancelar_inadimplencias_contratos_anteriores ON public.cobrancas;
CREATE TRIGGER trg_cancelar_inadimplencias_contratos_anteriores
AFTER UPDATE OF status ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.fn_cancelar_inadimplencias_contratos_anteriores();