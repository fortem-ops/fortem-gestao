-- Add scheduled start support to treinos
ALTER TABLE public.treinos ADD COLUMN IF NOT EXISTS data_inicio DATE;

ALTER TABLE public.treinos DROP CONSTRAINT IF EXISTS treinos_status_check;
ALTER TABLE public.treinos ADD CONSTRAINT treinos_status_check
  CHECK (status IN ('atual','arquivado','aguardando'));

CREATE INDEX IF NOT EXISTS idx_treinos_aguardando
  ON public.treinos(aluno_id, status, data_inicio)
  WHERE status = 'aguardando';

CREATE OR REPLACE FUNCTION public.ativar_treinos_agendados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT ON (aluno_id) id, aluno_id
    FROM public.treinos
    WHERE status = 'aguardando'
      AND data_inicio IS NOT NULL
      AND data_inicio <= CURRENT_DATE
    ORDER BY aluno_id, data_inicio ASC, created_at ASC
  ) LOOP
    UPDATE public.treinos
      SET status = 'arquivado', updated_at = now()
      WHERE aluno_id = r.aluno_id AND status = 'atual';
    UPDATE public.treinos
      SET status = 'atual', updated_at = now()
      WHERE id = r.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ativar_treinos_agendados() TO authenticated, anon;