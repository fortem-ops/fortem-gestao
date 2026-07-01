
CREATE TABLE public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_events TO authenticated;
GRANT ALL ON public.whatsapp_events TO service_role;

ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler eventos WhatsApp"
  ON public.whatsapp_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_whatsapp_events_created_at ON public.whatsapp_events (created_at DESC);
