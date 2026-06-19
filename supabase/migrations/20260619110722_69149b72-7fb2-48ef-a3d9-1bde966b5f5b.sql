
CREATE TABLE IF NOT EXISTS public.pipedrive_stage_mapping (
  pipedrive_stage_id int PRIMARY KEY,
  pipedrive_stage_name text,
  fortem_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipedrive_stage_mapping TO authenticated;
GRANT ALL ON public.pipedrive_stage_mapping TO service_role;

ALTER TABLE public.pipedrive_stage_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Coord manage stage mapping"
  ON public.pipedrive_stage_mapping
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE TRIGGER trg_pipedrive_stage_mapping_updated
  BEFORE UPDATE ON public.pipedrive_stage_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
