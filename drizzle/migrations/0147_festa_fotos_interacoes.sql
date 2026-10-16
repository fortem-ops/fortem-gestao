CREATE TABLE public.festa_fotos_curtidas (
  foto_id uuid NOT NULL REFERENCES public.festa_fotos(id) ON DELETE CASCADE,
  visitante_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (foto_id, visitante_id)
);
CREATE TABLE public.festa_fotos_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_id uuid NOT NULL REFERENCES public.festa_fotos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  texto text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX festa_fotos_coment_foto_idx ON public.festa_fotos_comentarios (foto_id, created_at);
GRANT SELECT, DELETE ON public.festa_fotos_curtidas, public.festa_fotos_comentarios TO authenticated;
GRANT ALL ON public.festa_fotos_curtidas, public.festa_fotos_comentarios TO service_role;
ALTER TABLE public.festa_fotos_curtidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festa_fotos_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY festa_curt_gestao_select ON public.festa_fotos_curtidas FOR SELECT TO authenticated USING (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_com_gestao_select ON public.festa_fotos_comentarios FOR SELECT TO authenticated USING (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_com_gestao_delete ON public.festa_fotos_comentarios FOR DELETE TO authenticated USING (public.fn_festa_gestao(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_festa_fotos_interacoes(_visitante text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(f.id, jsonb_build_object(
    'curtidas', (SELECT count(*) FROM festa_fotos_curtidas c WHERE c.foto_id = f.id),
    'curti', EXISTS (SELECT 1 FROM festa_fotos_curtidas c WHERE c.foto_id = f.id AND c.visitante_id = _visitante),
    'comentarios', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'texto', m.texto, 'created_at', m.created_at) ORDER BY m.created_at)
       FROM festa_fotos_comentarios m WHERE m.foto_id = f.id), '[]'::jsonb)
  )), '{}'::jsonb) FROM festa_fotos f;
$$;
GRANT EXECUTE ON FUNCTION public.fn_festa_fotos_interacoes(text) TO anon, authenticated;