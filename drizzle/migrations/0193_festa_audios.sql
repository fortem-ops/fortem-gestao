CREATE TABLE public.festa_audios (
  ano text PRIMARY KEY CHECK (ano ~ '^20(1[6-9]|2[0-7])$'),
  url_audio text NOT NULL,
  caminho text,
  duracao_segundos integer,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festa_audios TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.festa_audios TO authenticated;
GRANT ALL ON public.festa_audios TO service_role;
ALTER TABLE public.festa_audios ENABLE ROW LEVEL SECURITY;
CREATE POLICY festa_audios_publico_select ON public.festa_audios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY festa_audios_gestao_insert ON public.festa_audios FOR INSERT TO authenticated WITH CHECK (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_audios_gestao_update ON public.festa_audios FOR UPDATE TO authenticated USING (public.fn_festa_gestao(auth.uid())) WITH CHECK (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_audios_gestao_delete ON public.festa_audios FOR DELETE TO authenticated USING (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_audios_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'festa-audios' AND public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_audios_storage_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'festa-audios' AND public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_audios_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'festa-audios' AND public.fn_festa_gestao(auth.uid()));