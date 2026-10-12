ALTER TABLE public.creditos_aluno
  ADD COLUMN IF NOT EXISTS competencia date,
  ADD COLUMN IF NOT EXISTS reposicao_pct integer;

ALTER TABLE public.creditos_aluno
  ADD CONSTRAINT creditos_aluno_reposicao_so_treino_ck
  CHECK (coalesce(reposicao_pct,0) = 0 OR (atividade = 'Treino' AND reposicao_pct BETWEEN 1 AND 100));

CREATE UNIQUE INDEX IF NOT EXISTS creditos_aluno_competencia_uk
  ON public.creditos_aluno(origem_id, atividade, competencia) WHERE competencia IS NOT NULL;

CREATE TABLE public.creditos_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  credito_origem_id uuid NOT NULL REFERENCES public.creditos_aluno(id),
  credito_destino_id uuid NOT NULL REFERENCES public.creditos_aluno(id),
  saldo_origem integer NOT NULL CHECK (saldo_origem >= 0),
  percentual integer NOT NULL CHECK (percentual BETWEEN 1 AND 100),
  quantidade integer NOT NULL,
  automatico boolean NOT NULL DEFAULT true,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creditos_transferencias_origem_uk UNIQUE (credito_origem_id),
  CONSTRAINT creditos_transferencias_ceil_ck CHECK (quantidade = ceil(saldo_origem * percentual / 100.0)::int)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creditos_transferencias TO authenticated;
GRANT ALL ON public.creditos_transferencias TO service_role;
ALTER TABLE public.creditos_transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le transferencias" ON public.creditos_transferencias FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());
CREATE POLICY "coord admin grava transferencias" ON public.creditos_transferencias FOR ALL TO authenticated
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());