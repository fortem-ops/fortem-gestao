CREATE TABLE public.bodymap_region_overrides (
  region_id text PRIMARY KEY,
  cx numeric NOT NULL,
  cy numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.bodymap_region_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read bodymap overrides"
  ON public.bodymap_region_overrides FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can insert bodymap overrides"
  ON public.bodymap_region_overrides FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update bodymap overrides"
  ON public.bodymap_region_overrides FOR UPDATE
  TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete bodymap overrides"
  ON public.bodymap_region_overrides FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));