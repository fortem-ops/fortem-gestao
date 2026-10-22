-- Volta da remoção dos índices duplicados do audit_log (definições originais).
-- Mantidos: audit_log_tabela_created_at_idx (tabela, created_at DESC) e audit_log_user_id_idx (user_id, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON public.audit_log USING btree (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_log USING btree (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_data ON public.audit_log USING btree (user_id, created_at DESC);
