CREATE TABLE IF NOT EXISTS public.links_cartao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  usado boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links_cartao TO authenticated;
GRANT ALL ON public.links_cartao TO service_role;

ALTER TABLE public.links_cartao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord/Admin gerenciam links_cartao"
  ON public.links_cartao
  FOR ALL
  TO authenticated
  USING (public.is_coordenador_ou_admin())
  WITH CHECK (public.is_coordenador_ou_admin());

CREATE INDEX IF NOT EXISTS idx_links_cartao_token ON public.links_cartao(token);
CREATE INDEX IF NOT EXISTS idx_links_cartao_aluno ON public.links_cartao(aluno_id);