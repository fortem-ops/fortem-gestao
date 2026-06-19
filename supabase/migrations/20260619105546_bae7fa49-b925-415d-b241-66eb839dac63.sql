
ALTER TABLE public.pipeline_metadata
  ADD COLUMN IF NOT EXISTS pipedrive_person_id text,
  ADD COLUMN IF NOT EXISTS pipedrive_deal_id text,
  ADD COLUMN IF NOT EXISTS pipedrive_imported_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_metadata_pipedrive_person_uniq
  ON public.pipeline_metadata (pipedrive_person_id)
  WHERE pipedrive_person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_metadata_pipedrive_deal_uniq
  ON public.pipeline_metadata (pipedrive_deal_id)
  WHERE pipedrive_deal_id IS NOT NULL;

INSERT INTO public.lead_origens (nome, ativo)
SELECT 'Pipedrive', true
WHERE NOT EXISTS (SELECT 1 FROM public.lead_origens WHERE nome = 'Pipedrive');
