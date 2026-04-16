
ALTER TABLE public.exercicios_personalizados
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exercicios-videos', 'exercicios-videos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can view exercicio videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'exercicios-videos');

CREATE POLICY "Coord/admin can upload exercicio videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exercicios-videos' AND public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can update exercicio videos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'exercicios-videos' AND public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete exercicio videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'exercicios-videos' AND public.is_coordinator_or_admin(auth.uid()));
