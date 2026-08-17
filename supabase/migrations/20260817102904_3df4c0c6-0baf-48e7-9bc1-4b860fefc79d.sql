CREATE TABLE public.arquivos_metodologicos_pastas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES public.arquivos_metodologicos_pastas(id) ON DELETE CASCADE,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_am_pastas_parent ON public.arquivos_metodologicos_pastas(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivos_metodologicos_pastas TO authenticated;
GRANT ALL ON public.arquivos_metodologicos_pastas TO service_role;

ALTER TABLE public.arquivos_metodologicos_pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve pastas metodologicas"
  ON public.arquivos_metodologicos_pastas FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Equipe cria pastas metodologicas"
  ON public.arquivos_metodologicos_pastas FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Coord admin renomeia pastas metodologicas"
  ON public.arquivos_metodologicos_pastas FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord admin deleta pastas metodologicas"
  ON public.arquivos_metodologicos_pastas FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_am_pastas_updated_at
  BEFORE UPDATE ON public.arquivos_metodologicos_pastas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.arquivos_metodologicos_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pasta_id UUID REFERENCES public.arquivos_metodologicos_pastas(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes BIGINT,
  tipo_mime TEXT,
  enviado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_am_itens_pasta ON public.arquivos_metodologicos_itens(pasta_id);

GRANT SELECT, INSERT, DELETE ON public.arquivos_metodologicos_itens TO authenticated;
GRANT ALL ON public.arquivos_metodologicos_itens TO service_role;

ALTER TABLE public.arquivos_metodologicos_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve arquivos metodologicos"
  ON public.arquivos_metodologicos_itens FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Equipe envia arquivos metodologicos"
  ON public.arquivos_metodologicos_itens FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Coord admin deleta arquivos metodologicos"
  ON public.arquivos_metodologicos_itens FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Equipe le objetos metodologicos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'arquivos-metodologicos' AND public.is_staff());

CREATE POLICY "Equipe envia objetos metodologicos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arquivos-metodologicos' AND public.is_staff());

CREATE POLICY "Coord admin remove objetos metodologicos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'arquivos-metodologicos' AND public.is_coordinator_or_admin(auth.uid()));