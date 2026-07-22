
-- 1) contrato_templates
CREATE TABLE public.contrato_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  plano_tipo text NOT NULL,
  forma_pagamento text NOT NULL,
  conteudo text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_templates TO authenticated;
GRANT ALL ON public.contrato_templates TO service_role;

ALTER TABLE public.contrato_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY contrato_templates_admin_all ON public.contrato_templates
  FOR ALL USING (is_admin_role()) WITH CHECK (is_admin_role());
CREATE POLICY contrato_templates_coord_select ON public.contrato_templates
  FOR SELECT USING (is_coordenador_ou_admin());
CREATE POLICY contrato_templates_coord_insert ON public.contrato_templates
  FOR INSERT WITH CHECK (is_coordenador_ou_admin());
CREATE POLICY contrato_templates_coord_update ON public.contrato_templates
  FOR UPDATE USING (is_coordenador_ou_admin());

CREATE UNIQUE INDEX contrato_templates_ativo_unico
  ON public.contrato_templates (plano_tipo, forma_pagamento)
  WHERE ativo = true;

CREATE TRIGGER trg_contrato_templates_updated_at
  BEFORE UPDATE ON public.contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_contrato_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 2) regulamento_interno_versoes
CREATE TABLE public.regulamento_interno_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulamento_interno_versoes TO authenticated;
GRANT ALL ON public.regulamento_interno_versoes TO service_role;

ALTER TABLE public.regulamento_interno_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY regulamento_admin_all ON public.regulamento_interno_versoes
  FOR ALL USING (is_admin_role()) WITH CHECK (is_admin_role());
CREATE POLICY regulamento_coord_select ON public.regulamento_interno_versoes
  FOR SELECT USING (is_coordenador_ou_admin());
CREATE POLICY regulamento_coord_insert ON public.regulamento_interno_versoes
  FOR INSERT WITH CHECK (is_coordenador_ou_admin());
CREATE POLICY regulamento_coord_update ON public.regulamento_interno_versoes
  FOR UPDATE USING (is_coordenador_ou_admin());

CREATE UNIQUE INDEX regulamento_ativo_unico
  ON public.regulamento_interno_versoes ((true))
  WHERE ativo = true;

CREATE TRIGGER trg_regulamento_updated_at
  BEFORE UPDATE ON public.regulamento_interno_versoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_regulamento_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.regulamento_interno_versoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 3) contratos_documentos
CREATE TABLE public.contratos_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  template_id uuid REFERENCES public.contrato_templates(id),
  template_versao integer NOT NULL,
  regulamento_versao integer NOT NULL,
  conteudo_gerado text NOT NULL,
  variaveis_utilizadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  aceite boolean NOT NULL DEFAULT false,
  data_aceite timestamptz,
  formato_aceite text,
  ip_aceite text,
  assinatura text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_documentos TO authenticated;
GRANT ALL ON public.contratos_documentos TO service_role;

ALTER TABLE public.contratos_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratos_documentos_admin_all ON public.contratos_documentos
  FOR ALL USING (is_admin_role()) WITH CHECK (is_admin_role());
CREATE POLICY contratos_documentos_coord_select ON public.contratos_documentos
  FOR SELECT USING (is_coordenador_ou_admin());
CREATE POLICY contratos_documentos_coord_insert ON public.contratos_documentos
  FOR INSERT WITH CHECK (is_coordenador_ou_admin());
CREATE POLICY contratos_documentos_coord_update ON public.contratos_documentos
  FOR UPDATE USING (is_coordenador_ou_admin());
CREATE POLICY contratos_documentos_self_select ON public.contratos_documentos
  FOR SELECT USING (
    aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid())
  );

CREATE INDEX contratos_documentos_contrato_idx ON public.contratos_documentos(contrato_id);
CREATE INDEX contratos_documentos_aluno_idx ON public.contratos_documentos(aluno_id);

CREATE TRIGGER trg_contratos_documentos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos_documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
