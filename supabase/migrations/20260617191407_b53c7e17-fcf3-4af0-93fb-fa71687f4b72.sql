
CREATE OR REPLACE FUNCTION public.aluno_licencas_extende_plano()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta integer := 0;
  v_plano_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := COALESCE(NEW.dias, 0);
    v_plano_id := NEW.plano_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -COALESCE(OLD.dias, 0);
    v_plano_id := OLD.plano_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.plano_id IS DISTINCT FROM OLD.plano_id THEN
      UPDATE public.planos
        SET data_fim = data_fim - COALESCE(OLD.dias, 0),
            proxima_renovacao = CASE
              WHEN renovacao_automatica AND proxima_renovacao IS NOT NULL
                THEN proxima_renovacao - COALESCE(OLD.dias, 0)
              ELSE proxima_renovacao
            END
      WHERE id = OLD.plano_id AND data_fim IS NOT NULL;
      v_delta := COALESCE(NEW.dias, 0);
      v_plano_id := NEW.plano_id;
    ELSE
      v_delta := COALESCE(NEW.dias, 0) - COALESCE(OLD.dias, 0);
      v_plano_id := NEW.plano_id;
    END IF;
  END IF;

  IF v_delta <> 0 AND v_plano_id IS NOT NULL THEN
    UPDATE public.planos
      SET data_fim = data_fim + v_delta,
          proxima_renovacao = CASE
            WHEN renovacao_automatica AND proxima_renovacao IS NOT NULL
              THEN proxima_renovacao + v_delta
            ELSE proxima_renovacao
          END
    WHERE id = v_plano_id AND data_fim IS NOT NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_aluno_licencas_extende_plano ON public.aluno_licencas;
CREATE TRIGGER trg_aluno_licencas_extende_plano
AFTER INSERT OR UPDATE OR DELETE ON public.aluno_licencas
FOR EACH ROW EXECUTE FUNCTION public.aluno_licencas_extende_plano();
