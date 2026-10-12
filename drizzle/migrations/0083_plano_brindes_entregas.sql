CREATE TABLE public.plano_brindes_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  item text NOT NULL,
  entregue_por uuid,
  entregue_em date NOT NULL DEFAULT current_date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plano_brindes_entregas_uk UNIQUE (plano_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_brindes_entregas TO authenticated;
GRANT ALL ON public.plano_brindes_entregas TO service_role;
ALTER TABLE public.plano_brindes_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le brindes" ON public.plano_brindes_entregas FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());
CREATE POLICY "coord admin grava brindes" ON public.plano_brindes_entregas FOR ALL TO authenticated
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());