
ALTER TABLE public.avaliacao_protocolos
  ADD COLUMN IF NOT EXISTS permite_upload boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.avaliacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  tipo text NOT NULL DEFAULT 'arquivo',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_anexos_avaliacao ON public.avaliacao_anexos(avaliacao_id);

ALTER TABLE public.avaliacao_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view avaliacao_anexos"
  ON public.avaliacao_anexos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Author or coord/admin can insert avaliacao_anexos"
  ON public.avaliacao_anexos FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      is_coordinator_or_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.avaliacoes a
        WHERE a.id = avaliacao_anexos.avaliacao_id AND a.avaliador_id = auth.uid()
      )
    )
  );

CREATE POLICY "Author or coord/admin can delete avaliacao_anexos"
  ON public.avaliacao_anexos FOR DELETE TO authenticated
  USING (
    is_coordinator_or_admin(auth.uid()) OR uploaded_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.avaliacoes a
      WHERE a.id = avaliacao_anexos.avaliacao_id AND a.avaliador_id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public)
  VALUES ('aluno-files', 'aluno-files', false)
  ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated can read avaliacao anexos'
  ) THEN
    CREATE POLICY "Authenticated can read avaliacao anexos"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'aluno-files' AND (storage.foldername(name))[1] = 'avaliacoes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated can upload avaliacao anexos'
  ) THEN
    CREATE POLICY "Authenticated can upload avaliacao anexos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'aluno-files' AND (storage.foldername(name))[1] = 'avaliacoes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated can delete avaliacao anexos'
  ) THEN
    CREATE POLICY "Authenticated can delete avaliacao anexos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'aluno-files' AND (storage.foldername(name))[1] = 'avaliacoes');
  END IF;
END $$;
