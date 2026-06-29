
-- 1) Novos campos opcionais em pipeline_metadata
ALTER TABLE public.pipeline_metadata
  ADD COLUMN IF NOT EXISTS plano_interesse text,
  ADD COLUMN IF NOT EXISTS notas text;

ALTER TABLE public.pipeline_metadata
  DROP CONSTRAINT IF EXISTS pipeline_metadata_plano_interesse_check;
ALTER TABLE public.pipeline_metadata
  ADD CONSTRAINT pipeline_metadata_plano_interesse_check
  CHECK (plano_interesse IS NULL OR plano_interesse IN ('Start','Start+','Power','Pro','Max'));

-- 2) Probabilidade por etapa
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS probabilidade smallint;

-- Backfill defaults sensatos por etapa conhecida (sem alterar nomes/posições)
UPDATE public.pipeline_stages SET probabilidade = CASE name
  WHEN 'Novo lead' THEN 10
  WHEN 'Informações encaminhadas' THEN 25
  WHEN 'Prospect' THEN 40
  WHEN 'Treino experimental agendado' THEN 60
  WHEN 'Follow Up' THEN 75
  WHEN 'Aluno ativo' THEN 100
  WHEN 'Renovação de plano' THEN 80
  WHEN 'Risco de evasão' THEN 35
  WHEN 'Aluno inativo' THEN 0
  WHEN 'Aluno perdido' THEN 0
  ELSE probabilidade
END
WHERE probabilidade IS NULL;

-- 3) Trigger para manter pipeline_metadata.last_contact_at em sincronia com
--    novas movimentações e tarefas (para cálculo de temperatura).
CREATE OR REPLACE FUNCTION public.fn_pipeline_touch_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aluno_id IS NOT NULL THEN
    INSERT INTO public.pipeline_metadata (aluno_id, last_contact_at, updated_at)
    VALUES (NEW.aluno_id, now(), now())
    ON CONFLICT (aluno_id) DO UPDATE
      SET last_contact_at = now(),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_touch_movement ON public.pipeline_movements;
CREATE TRIGGER trg_pipeline_touch_movement
AFTER INSERT ON public.pipeline_movements
FOR EACH ROW EXECUTE FUNCTION public.fn_pipeline_touch_activity();

DROP TRIGGER IF EXISTS trg_pipeline_touch_tarefa ON public.tarefas;
CREATE TRIGGER trg_pipeline_touch_tarefa
AFTER INSERT OR UPDATE ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.fn_pipeline_touch_activity();
