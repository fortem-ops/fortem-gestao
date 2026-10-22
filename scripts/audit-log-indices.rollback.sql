-- Volta da remoção dos índices duplicados do audit_log (definições originais).
CREATE INDEX IF NOT EXISTS audit_log_tabela_created_at_idx ON public.audit_log USING btree (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_log USING btree (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_data ON public.audit_log USING btree (user_id, created_at DESC);
