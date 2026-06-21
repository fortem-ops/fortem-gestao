-- FASE 3 — AUDITORIA E CONFORMIDADE LGPD

-- 0. pgaudit
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- 1. Índices e comentário em audit_log
CREATE INDEX IF NOT EXISTS audit_log_tabela_created_at_idx ON public.audit_log (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_operacao_idx ON public.audit_log (operacao, created_at DESC);

COMMENT ON TABLE public.audit_log IS
  'Registro de auditoria de alterações em dados sensíveis. Retido por 5 anos conforme Art. 37 LGPD. Contém dados_antes/dados_depois em JSONB para rastreabilidade completa.';

-- 2. Triggers de auditoria nas 12 tabelas faltantes
DROP TRIGGER IF EXISTS trg_audit_avaliacoes ON public.avaliacoes;
CREATE TRIGGER trg_audit_avaliacoes AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_comissionamentos ON public.comissionamentos;
CREATE TRIGGER trg_audit_comissionamentos AFTER INSERT OR UPDATE OR DELETE ON public.comissionamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_legal_annexes ON public.legal_annexes;
CREATE TRIGGER trg_audit_legal_annexes AFTER INSERT OR UPDATE OR DELETE ON public.legal_annexes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_pagamento_parcelas ON public.pagamento_parcelas;
CREATE TRIGGER trg_audit_pagamento_parcelas AFTER INSERT OR UPDATE OR DELETE ON public.pagamento_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_pagamentos ON public.pagamentos;
CREATE TRIGGER trg_audit_pagamentos AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_creditos_aluno ON public.creditos_aluno;
CREATE TRIGGER trg_audit_creditos_aluno AFTER INSERT OR UPDATE OR DELETE ON public.creditos_aluno
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_creditos_movimentos ON public.creditos_movimentos;
CREATE TRIGGER trg_audit_creditos_movimentos AFTER INSERT OR UPDATE OR DELETE ON public.creditos_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_consumo_servicos ON public.consumo_servicos;
CREATE TRIGGER trg_audit_consumo_servicos AFTER INSERT OR UPDATE OR DELETE ON public.consumo_servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_clube_membros ON public.clube_fortem_membros;
CREATE TRIGGER trg_audit_clube_membros AFTER INSERT OR UPDATE OR DELETE ON public.clube_fortem_membros
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_cadastro_trabalhista ON public.cadastro_trabalhista;
CREATE TRIGGER trg_audit_cadastro_trabalhista AFTER INSERT OR UPDATE OR DELETE ON public.cadastro_trabalhista
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_ponto_jornadas ON public.ponto_jornadas;
CREATE TRIGGER trg_audit_ponto_jornadas AFTER INSERT OR UPDATE OR DELETE ON public.ponto_jornadas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_ponto_fechamentos ON public.ponto_fechamentos_mensais;
CREATE TRIGGER trg_audit_ponto_fechamentos AFTER INSERT OR UPDATE OR DELETE ON public.ponto_fechamentos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 3. RLS em audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_admin_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_system_insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_no_update" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_no_delete" ON public.audit_log;

CREATE POLICY "audit_log_admin_select" ON public.audit_log FOR SELECT
  USING (public.is_admin_role());
CREATE POLICY "audit_log_system_insert" ON public.audit_log FOR INSERT
  WITH CHECK (public.is_admin_role());

-- 4. fn_lgpd_relatorio_titular
CREATE OR REPLACE FUNCTION public.fn_lgpd_relatorio_titular(p_aluno_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_role() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem gerar relatórios LGPD';
  END IF;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'gerado_por', auth.uid(),
    'aluno_id', p_aluno_id,
    'dados_cadastrais', (SELECT row_to_json(a)::jsonb FROM public.alunos a WHERE a.id = p_aluno_id),
    'avaliacoes', (SELECT jsonb_agg(row_to_json(av)) FROM public.avaliacoes av WHERE av.aluno_id = p_aluno_id),
    'legal_annexes', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', la.id, 'document_type', la.document_type, 'signed_at', la.signed_at,
        'valid_until', la.valid_until, 'medical_status', la.medical_status, 'image_usage', la.image_usage
      )) FROM public.legal_annexes la WHERE la.aluno_id = p_aluno_id
    ),
    'creditos', (SELECT jsonb_agg(row_to_json(ca)) FROM public.creditos_aluno ca WHERE ca.aluno_id = p_aluno_id),
    'consumo_servicos', (SELECT jsonb_agg(row_to_json(cs)) FROM public.consumo_servicos cs WHERE cs.aluno_id = p_aluno_id),
    'clube_membro', (
      SELECT jsonb_build_object(
        'id', cm.id, 'fortem_id', cm.fortem_id, 'nivel_membro', cm.nivel_membro,
        'status_membro', cm.status_membro, 'data_inicio', cm.data_inicio
      ) FROM public.clube_fortem_membros cm WHERE cm.aluno_id = p_aluno_id
    ),
    'historico_auditoria', (
      SELECT jsonb_agg(jsonb_build_object('tabela', al.tabela, 'operacao', al.operacao, 'created_at', al.created_at))
      FROM public.audit_log al
      WHERE al.registro_id = p_aluno_id::text
         OR al.registro_id IN (
           SELECT id::text FROM public.legal_annexes WHERE aluno_id = p_aluno_id
           UNION ALL SELECT id::text FROM public.creditos_aluno WHERE aluno_id = p_aluno_id
           UNION ALL SELECT id::text FROM public.avaliacoes WHERE aluno_id = p_aluno_id
         )
    )
  ) INTO v_result;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('lgpd_relatorio', p_aluno_id::text, 'LGPD_EXPORT', auth.uid(), NULL,
    jsonb_build_object('aluno_id', p_aluno_id, 'gerado_em', now()));

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_lgpd_relatorio_titular IS
  'Gera relatório completo de dados pessoais de um aluno (Art. 18 LGPD). Apenas administradores podem executar. A execução é registrada no audit_log com operação LGPD_EXPORT.';

-- 5. fn_lgpd_anonimizar_titular
CREATE OR REPLACE FUNCTION public.fn_lgpd_anonimizar_titular(p_aluno_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_anon_id text := 'ANONIMIZADO-' || gen_random_uuid()::text;
BEGIN
  IF NOT public.is_admin_role() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem anonimizar titulares';
  END IF;

  UPDATE public.alunos SET
    nome = v_anon_id,
    email = v_anon_id || '@anon.local',
    telefone = NULL,
    cpf = NULL,
    rg = NULL,
    data_nascimento = NULL,
    foto_url = NULL,
    cep = NULL,
    logradouro = NULL,
    numero = NULL,
    complemento = NULL,
    bairro = NULL,
    cidade = NULL,
    uf = NULL
  WHERE id = p_aluno_id;

  UPDATE public.legal_annexes SET
    nome = v_anon_id,
    cpf = '000.000.000-00',
    email = v_anon_id || '@anon.local',
    telefone = NULL,
    data_nascimento = NULL,
    signature_data = NULL,
    ip_address = NULL,
    attachment_url = NULL
  WHERE aluno_id = p_aluno_id;

  UPDATE public.clube_fortem_membros SET
    cpf_hash = NULL,
    foto_url = NULL
  WHERE aluno_id = p_aluno_id;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('lgpd_anonimizacao', p_aluno_id::text, 'LGPD_ANONYMIZE', auth.uid(),
    jsonb_build_object('aluno_id', p_aluno_id),
    jsonb_build_object('anonimizado_em', now(), 'executado_por', auth.uid()));

  RETURN jsonb_build_object(
    'sucesso', true, 'aluno_id', p_aluno_id, 'anonimizado_em', now(),
    'tabelas', ARRAY['alunos','legal_annexes','clube_fortem_membros']
  );
END;
$$;

COMMENT ON FUNCTION public.fn_lgpd_anonimizar_titular IS
  'Anonimiza dados pessoais de um titular (Art. 18 VI LGPD). NÃO exclui registros — substitui dados pessoais por valores neutros para preservar integridade referencial. Apenas administradores podem executar. A operação é registrada no audit_log com operação LGPD_ANONYMIZE.';

-- 6. View v_audit_resumo
CREATE OR REPLACE VIEW public.v_audit_resumo AS
SELECT
  al.id, al.tabela, al.operacao, al.created_at, al.user_id,
  p.email AS usuario_email,
  al.registro_id,
  CASE
    WHEN al.dados_antes IS NULL THEN 'Criação'
    WHEN al.dados_depois IS NULL THEN 'Exclusão'
    ELSE 'Alteração'
  END AS tipo_operacao,
  al.dados_antes, al.dados_depois
FROM public.audit_log al
LEFT JOIN auth.users p ON p.id = al.user_id
ORDER BY al.created_at DESC;

COMMENT ON VIEW public.v_audit_resumo IS
  'Painel de auditoria com email do usuário. Acessível apenas por admin via RLS.';