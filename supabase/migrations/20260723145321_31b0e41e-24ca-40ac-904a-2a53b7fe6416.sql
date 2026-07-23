
DROP POLICY IF EXISTS "Authenticated can read bodymap overrides" ON public.bodymap_region_overrides;
CREATE POLICY "Staff can read bodymap overrides"
  ON public.bodymap_region_overrides FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.cartoes_salvos_protect_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.aluno_id IS DISTINCT FROM OLD.aluno_id THEN
    RAISE EXCEPTION 'aluno_id is immutable on cartoes_salvos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cartoes_salvos_protect ON public.cartoes_salvos;
CREATE TRIGGER trg_cartoes_salvos_protect
  BEFORE UPDATE ON public.cartoes_salvos
  FOR EACH ROW EXECUTE FUNCTION public.cartoes_salvos_protect_immutable();

DROP POLICY IF EXISTS "aluno_read_ranking" ON public.clube_ranking_snapshots;
CREATE POLICY "aluno_read_ranking"
  ON public.clube_ranking_snapshots FOR SELECT
  TO authenticated
  USING (
    aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid())
  );
