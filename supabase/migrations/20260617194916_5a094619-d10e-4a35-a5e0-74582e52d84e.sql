CREATE OR REPLACE FUNCTION public.aluno_licencas_extende_plano()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta integer := 0;
  v_plano_id uuid;
  v_data_fim date;
  v_data_inicio date;
  v_duracao integer;
  v_renov_auto boolean;
  v_prox_renov date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := COALESCE(NEW.dias, 0);
    v_plano_id := NEW.plano_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -COALESCE(OLD.dias, 0);
    v_plano_id := OLD.plano_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.plano_id IS DISTINCT FROM OLD.plano_id THEN
      -- revert OLD
      SELECT data_fim, renovacao_automatica, proxima_renovacao
        INTO v_data_fim, v_renov_auto, v_prox_renov
        FROM public.planos WHERE id = OLD.plano_id;
      IF v_data_fim IS NOT NULL THEN
        UPDATE public.planos
          SET data_fim = data_fim - COALESCE(OLD.dias, 0),
              proxima_renovacao = CASE
                WHEN renovacao_automatica AND proxima_renovacao IS NOT NULL
                  THEN proxima_renovacao - COALESCE(OLD.dias, 0)
                ELSE proxima_renovacao
              END
          WHERE id = OLD.plano_id;
      END IF;
      v_delta := COALESCE(NEW.dias, 0);
      v_plano_id := NEW.plano_id;
    ELSE
      v_delta := COALESCE(NEW.dias, 0) - COALESCE(OLD.dias, 0);
      v_plano_id := NEW.plano_id;
    END IF;
  END IF;

  IF v_delta = 0 OR v_plano_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT data_fim, data_inicio, duracao_meses, renovacao_automatica, proxima_renovacao
    INTO v_data_fim, v_data_inicio, v_duracao, v_renov_auto, v_prox_renov
    FROM public.planos WHERE id = v_plano_id;

  IF v_data_fim IS NOT NULL THEN
    UPDATE public.planos
      SET data_fim = data_fim + v_delta,
          proxima_renovacao = CASE
            WHEN renovacao_automatica AND proxima_renovacao IS NOT NULL
              THEN proxima_renovacao + v_delta
            ELSE proxima_renovacao
          END
      WHERE id = v_plano_id;
  ELSIF v_delta > 0 AND v_data_inicio IS NOT NULL AND v_duracao IS NOT NULL THEN
    -- Materialize data_fim from data_inicio + duracao_meses, then apply delta
    UPDATE public.planos
      SET data_fim = (v_data_inicio + (v_duracao || ' months')::interval)::date + v_delta,
          proxima_renovacao = CASE
            WHEN renovacao_automatica AND proxima_renovacao IS NOT NULL
              THEN proxima_renovacao + v_delta
            ELSE proxima_renovacao
          END
      WHERE id = v_plano_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;