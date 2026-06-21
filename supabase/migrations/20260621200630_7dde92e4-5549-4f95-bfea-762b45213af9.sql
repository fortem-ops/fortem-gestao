DROP VIEW IF EXISTS public.v_audit_resumo;

CREATE VIEW public.v_audit_resumo
WITH (security_invoker = true) AS
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
LEFT JOIN auth.users p ON p.id = al.user_id;

REVOKE ALL ON public.v_audit_resumo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_audit_resumo TO service_role;

COMMENT ON VIEW public.v_audit_resumo IS
  'Painel de auditoria com email do usuário. Acessível apenas pelo service_role (edge functions admin). Usa security_invoker para respeitar RLS do audit_log.';