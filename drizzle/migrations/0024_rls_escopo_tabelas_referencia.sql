-- Helper: leitura permitida a staff ou a alunos vinculados (portal)
CREATE OR REPLACE FUNCTION public.is_staff_or_aluno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff() OR public.fn_current_aluno_id() IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_or_aluno() TO authenticated;

-- ── Tabelas internas: somente staff ──────────────────────────────
DROP POLICY IF EXISTS "Authenticated read avaliacao_templates" ON public.avaliacao_templates;
CREATE POLICY "Staff read avaliacao_templates" ON public.avaliacao_templates
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated users can view escolhas" ON public.banco_treinos_escolhas;
CREATE POLICY "Staff view escolhas" ON public.banco_treinos_escolhas
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "view_motivos" ON public.cancelamento_motivos;
CREATE POLICY "staff_view_motivos" ON public.cancelamento_motivos
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated can view lead_origens" ON public.lead_origens;
CREATE POLICY "Staff can view lead_origens" ON public.lead_origens
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated can view nao_conv_motivos" ON public.prospect_nao_conversao_motivos;
CREATE POLICY "Staff can view nao_conv_motivos" ON public.prospect_nao_conversao_motivos
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated can view stages" ON public.pipeline_stages;
CREATE POLICY "Staff can view stages" ON public.pipeline_stages
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated can view formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Staff can view formas_pagamento" ON public.formas_pagamento
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "View categorias custom" ON public.notificacao_categorias_custom;
CREATE POLICY "Staff view categorias custom" ON public.notificacao_categorias_custom
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "view_alertas_config" ON public.relatorios_alertas_config;
CREATE POLICY "staff_view_alertas_config" ON public.relatorios_alertas_config
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "atv_view_auth" ON public.ponto_atividades_especiais;
CREATE POLICY "atv_view_staff" ON public.ponto_atividades_especiais
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "autenticados podem ler politica retencao" ON public.ponto_politica_retencao;
CREATE POLICY "staff le politica retencao" ON public.ponto_politica_retencao
  FOR SELECT TO authenticated USING (public.is_staff());

-- ── Tabelas usadas também pelo Portal do Aluno ────────────────────
DROP POLICY IF EXISTS "Authenticated read avaliacao_protocolos" ON public.avaliacao_protocolos;
CREATE POLICY "Staff/aluno read avaliacao_protocolos" ON public.avaliacao_protocolos
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated read avaliacao_tipos" ON public.avaliacao_tipos;
CREATE POLICY "Staff/aluno read avaliacao_tipos" ON public.avaliacao_tipos
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated can view exercicio_articulacoes" ON public.exercicio_articulacoes;
CREATE POLICY "Staff/aluno view exercicio_articulacoes" ON public.exercicio_articulacoes
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated can view exercicio_categorias" ON public.exercicio_categorias;
CREATE POLICY "Staff/aluno view exercicio_categorias" ON public.exercicio_categorias
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated users can view exercicios" ON public.exercicios_personalizados;
CREATE POLICY "Staff/aluno view exercicios" ON public.exercicios_personalizados
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "catalogo_planos_view_all" ON public.planos_catalogo;
CREATE POLICY "catalogo_planos_view_staff_aluno" ON public.planos_catalogo
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "catalogo_servicos_view_all" ON public.servicos_catalogo;
CREATE POLICY "catalogo_servicos_view_staff_aluno" ON public.servicos_catalogo
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated can view beneficios" ON public.beneficios;
CREATE POLICY "Staff/aluno view beneficios" ON public.beneficios
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated can view regras" ON public.regras_elegibilidade;
CREATE POLICY "Staff/aluno view regras" ON public.regras_elegibilidade
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "Authenticated can read bodymap shapes" ON public.bodymap_shapes;
CREATE POLICY "Staff/aluno read bodymap shapes" ON public.bodymap_shapes
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "aluno_read_clima" ON public.clube_clima_cache;
CREATE POLICY "aluno_read_clima" ON public.clube_clima_cache
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

DROP POLICY IF EXISTS "aluno_read_regras" ON public.clube_regras_pontuacao;
CREATE POLICY "aluno_read_regras" ON public.clube_regras_pontuacao
  FOR SELECT TO authenticated USING (public.is_staff_or_aluno());

-- ── Loja pública: apenas a promoção ativa e vigente ───────────────
DROP POLICY IF EXISTS "brinde_config_leitura_publica" ON public.loja_promocao_brinde;
CREATE POLICY "brinde_config_leitura_publica" ON public.loja_promocao_brinde
  FOR SELECT USING (ativo = true AND (data_fim IS NULL OR data_fim >= CURRENT_DATE));
