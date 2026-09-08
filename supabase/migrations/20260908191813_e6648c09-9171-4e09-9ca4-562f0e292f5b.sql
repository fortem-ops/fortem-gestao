ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_tipo_check;

CREATE OR REPLACE FUNCTION public.fn_avaliacoes_validar_tipo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo do relatório não informado.';
  END IF;

  IF NEW.tipo = ANY (ARRAY['funcional','composicao_corporal','pliometria','forca','experimental','kinology','funcional_v2']) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.avaliacao_tipos t WHERE t.slug = NEW.tipo) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Tipo de avaliação/relatório "%" não está cadastrado em Administração.', NEW.tipo;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacoes_validar_tipo ON public.avaliacoes;
CREATE TRIGGER trg_avaliacoes_validar_tipo
BEFORE INSERT OR UPDATE OF tipo ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_avaliacoes_validar_tipo();

REVOKE ALL ON FUNCTION public.fn_avaliacoes_validar_tipo() FROM PUBLIC, anon, authenticated;