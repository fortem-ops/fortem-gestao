ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'tecnico';

ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_origem_check;

ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_origem_check CHECK (origem IN ('tecnico','pipeline'));

UPDATE public.tarefas
SET origem = 'pipeline'
WHERE origem <> 'pipeline'
  AND (
    tipo_auto LIKE 'pipeline_%'
    OR tipo_atividade IN ('ligacao','whatsapp','reuniao','email','visita')
  );

CREATE INDEX IF NOT EXISTS idx_tarefas_aluno_origem ON public.tarefas (aluno_id, origem);

CREATE OR REPLACE FUNCTION public.fn_tarefas_set_origem()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_auto IS NOT NULL AND NEW.tipo_auto LIKE 'pipeline_%' THEN
    NEW.origem := 'pipeline';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefas_set_origem ON public.tarefas;
CREATE TRIGGER trg_tarefas_set_origem
BEFORE INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefas_set_origem();