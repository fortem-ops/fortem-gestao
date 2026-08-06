CREATE TABLE public.avaliacoes_comparativos_salvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  nota text,
  modo text NOT NULL CHECK (modo IN ('auto','datas','intervalo')),
  data_a date,
  data_b date,
  intervalo_de date,
  intervalo_ate date,
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_comparativos_salvos TO authenticated;
GRANT ALL ON public.avaliacoes_comparativos_salvos TO service_role;

ALTER TABLE public.avaliacoes_comparativos_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view comparativos salvos"
ON public.avaliacoes_comparativos_salvos FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert comparativos salvos"
ON public.avaliacoes_comparativos_salvos FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND criado_por = auth.uid());

CREATE POLICY "Owner or coord/admin can update comparativos salvos"
ON public.avaliacoes_comparativos_salvos FOR UPDATE TO authenticated
USING (criado_por = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Owner or coord/admin can delete comparativos salvos"
ON public.avaliacoes_comparativos_salvos FOR DELETE TO authenticated
USING (criado_por = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

CREATE INDEX idx_comparativos_salvos_aluno ON public.avaliacoes_comparativos_salvos(aluno_id, created_at DESC);