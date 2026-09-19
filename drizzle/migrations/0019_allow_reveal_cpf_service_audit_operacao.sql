ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_operacao_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_operacao_check
  CHECK (operacao = ANY (ARRAY['insert','update','delete','REVEAL_CPF','REVEAL_CPF_SERVICE','EDIT_CPF']));