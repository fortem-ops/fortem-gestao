ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_operacao_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_operacao_check CHECK (
    operacao = ANY (ARRAY[
      'insert'::text,
      'update'::text,
      'delete'::text,
      'REVEAL_CPF'::text,
      'REVEAL_CPF_SERVICE'::text,
      'EDIT_CPF'::text,
      'login_sucesso'::text,
      'login_falha'::text,
      'login_bloqueado'::text,
      'cron_alertas_diarios'::text,
      'cron_alertas_diarios_noop'::text,
      'lgpd_relatorio'::text,
      'lgpd_anonimizacao'::text,
      'estorno'::text,
      'MFA_RESET'::text,
      'USER_DELETE'::text,
      'DESVINCULO_LOGIN'::text,
      'venda_retroativa'::text
    ])
  );