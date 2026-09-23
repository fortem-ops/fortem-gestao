CREATE TABLE public.auditoria_inconsistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  subtipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'atencao',
  descricao text NOT NULL,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  registros_afetados jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberto',
  nota_resolucao text,
  resolvido_por uuid,
  resolvido_em timestamptz,
  detectado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.auditoria_inconsistencias TO authenticated;
GRANT ALL ON public.auditoria_inconsistencias TO service_role;

ALTER TABLE public.auditoria_inconsistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff le auditoria" ON public.auditoria_inconsistencias
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Admin atualiza auditoria" ON public.auditoria_inconsistencias
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin insere auditoria" ON public.auditoria_inconsistencias
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_auditoria_status_sev ON public.auditoria_inconsistencias (status, severidade);
CREATE INDEX idx_auditoria_categoria ON public.auditoria_inconsistencias (categoria, subtipo);
CREATE INDEX idx_auditoria_aluno ON public.auditoria_inconsistencias (aluno_id);
CREATE UNIQUE INDEX uniq_auditoria_aberta ON public.auditoria_inconsistencias
  (categoria, subtipo, md5(registros_afetados::text)) WHERE status = 'aberto';

CREATE TABLE public.integracao_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  data_validade date,
  dias_alerta integer NOT NULL DEFAULT 30,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_por uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.integracao_certificados TO authenticated;
GRANT ALL ON public.integracao_certificados TO service_role;

ALTER TABLE public.integracao_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff le certificados" ON public.integracao_certificados
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Admin gerencia certificados" ON public.integracao_certificados
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));