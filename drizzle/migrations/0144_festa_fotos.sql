CREATE TABLE public.festa_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano text NOT NULL,
  url text NOT NULL,
  caminho text,
  alt text,
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festa_fotos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festa_fotos TO authenticated;
GRANT ALL ON public.festa_fotos TO service_role;
ALTER TABLE public.festa_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY festa_fotos_publico_select ON public.festa_fotos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY festa_fotos_gestao_insert ON public.festa_fotos FOR INSERT TO authenticated WITH CHECK (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_fotos_gestao_update ON public.festa_fotos FOR UPDATE TO authenticated USING (public.fn_festa_gestao(auth.uid())) WITH CHECK (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_fotos_gestao_delete ON public.festa_fotos FOR DELETE TO authenticated USING (public.fn_festa_gestao(auth.uid()));
CREATE INDEX festa_fotos_ano_ordem ON public.festa_fotos (ano, ordem);
INSERT INTO public.festa_fotos (ano, url, alt, ordem) VALUES
 ('2016','/__l5e/assets-v1/472f6065-c24e-465b-9186-d695aed89b8e/festa-2016.jpg','A primeira sede da FORTEM em obras, em 2016',0),
 ('2017','/__l5e/assets-v1/261c5ee2-3e22-4175-b99e-d008b7a3c679/festa-2017-1.jpg','Alunos em treino funcional na sede da FORTEM, 2017',0),
 ('2017','/__l5e/assets-v1/9e0b20bb-60fd-457a-9d7c-461f828e9dfe/festa-2017-2.jpg','Alunos fazendo agachamento com barra na FORTEM, 2017',1);
CREATE POLICY festa_fotos_storage_select ON storage.objects FOR SELECT USING (bucket_id = 'festa-fotos');
CREATE POLICY festa_fotos_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'festa-fotos' AND public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_fotos_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'festa-fotos' AND public.fn_festa_gestao(auth.uid()));