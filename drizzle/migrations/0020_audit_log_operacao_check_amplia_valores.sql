ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_operacao_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_operacao_check
  CHECK (operacao = ANY (ARRAY[
    'insert','update','delete',
    'REVEAL_CPF','REVEAL_CPF_SERVICE','EDIT_CPF',
    'login_sucesso','login_falha','login_bloqueado',
    'cron_alertas_diarios','cron_alertas_diarios_noop',
    'lgpd_relatorio','lgpd_anonimizacao'
  ]));