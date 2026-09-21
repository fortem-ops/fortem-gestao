CREATE OR REPLACE FUNCTION public.fn_avaliacoes_validar_quadriceps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  m jsonb;
  v numeric;
BEGIN
  IF NEW.dados IS NULL OR jsonb_typeof(NEW.dados -> 'metricas') <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR m IN SELECT * FROM jsonb_array_elements(NEW.dados -> 'metricas')
  LOOP
    IF jsonb_typeof(m) = 'object' AND (m ->> 'metric') = 'Flexibilidade Quadríceps' THEN
      FOREACH v IN ARRAY ARRAY[
        NULLIF(m ->> 'left', '')::numeric,
        NULLIF(m ->> 'right', '')::numeric
      ]
      LOOP
        IF v IS NOT NULL AND v < 100 THEN
          RAISE EXCEPTION 'Flexibilidade Quadríceps: o valor clínico deve ser 100° ou mais. Digite a leitura do goniômetro (abaixo de 90°) — o sistema soma os 90° automaticamente — ou o valor clínico completo.'
            USING ERRCODE = 'check_violation';
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacoes_validar_quadriceps ON public.avaliacoes;

CREATE TRIGGER trg_avaliacoes_validar_quadriceps
BEFORE INSERT OR UPDATE ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_avaliacoes_validar_quadriceps();