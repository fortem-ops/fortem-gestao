-- Volta da migração 0143 (festa 10 anos v2). Apaga dados da festa v2.
DROP TRIGGER IF EXISTS festa_conf_auditar ON public.festa_confirmacoes;
DROP FUNCTION IF EXISTS public.fn_festa_conf_auditar();
DROP FUNCTION IF EXISTS public.fn_festa_total_confirmados();
DROP POLICY IF EXISTS festa_conf_gestao_select ON public.festa_confirmacoes;
DROP POLICY IF EXISTS festa_conf_gestao_insert ON public.festa_confirmacoes;
DROP POLICY IF EXISTS festa_conf_gestao_update ON public.festa_confirmacoes;
DROP TABLE IF EXISTS public.festa_rate_limit, public.festa_eventos, public.festa_vouchers, public.festa_acompanhantes;
DROP FUNCTION IF EXISTS public.fn_festa_gestao(uuid);
DROP INDEX IF EXISTS public.festa_conf_whatsapp_ativo_uidx, public.festa_conf_txid_uidx, public.festa_conf_acesso_uidx;
ALTER TABLE public.festa_confirmacoes DROP CONSTRAINT IF EXISTS festa_conf_status_chk, DROP CONSTRAINT IF EXISTS festa_conf_origem_chk,
  DROP COLUMN IF EXISTS consumo, DROP COLUMN IF EXISTS intolerancias, DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS origem,
  DROP COLUMN IF EXISTS voucher_id, DROP COLUMN IF EXISTS total_centavos, DROP COLUMN IF EXISTS txid, DROP COLUMN IF EXISTS pix_copia_e_cola,
  DROP COLUMN IF EXISTS pix_expira_em, DROP COLUMN IF EXISTS pago_em, DROP COLUMN IF EXISTS pago_valor_centavos, DROP COLUMN IF EXISTS pagamento_forma,
  DROP COLUMN IF EXISTS acesso_hash, DROP COLUMN IF EXISTS observacao, DROP COLUMN IF EXISTS atualizado_em, DROP COLUMN IF EXISTS atualizado_por, DROP COLUMN IF EXISTS criado_por;
CREATE UNIQUE INDEX IF NOT EXISTS festa_confirmacoes_whatsapp_uidx ON public.festa_confirmacoes (whatsapp);
CREATE POLICY festa_confirmacoes_staff_select ON public.festa_confirmacoes FOR SELECT TO authenticated USING (is_staff(auth.uid()));
