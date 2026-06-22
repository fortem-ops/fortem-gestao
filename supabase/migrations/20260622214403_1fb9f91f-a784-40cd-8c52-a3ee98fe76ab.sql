-- 1. Enum venda_status
DO $$ BEGIN
  ALTER TYPE venda_status ADD VALUE IF NOT EXISTS 'falha';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE venda_status ADD VALUE IF NOT EXISTS 'estornado';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. cartoes_salvos
CREATE TABLE IF NOT EXISTS public.cartoes_salvos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id         uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token_rede       text NOT NULL,
  brand            text NOT NULL,
  last4            text NOT NULL,
  holder_name      text NOT NULL,
  expiration_month smallint NOT NULL,
  expiration_year  smallint NOT NULL,
  ativo            boolean NOT NULL DEFAULT true,
  is_default       boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.cartoes_salvos IS
  'Tokens de cartao salvos para recorrencia. Nunca armazena PAN ou CVV. LGPD: dado pessoal financeiro.';

GRANT SELECT, DELETE ON public.cartoes_salvos TO authenticated;
GRANT ALL ON public.cartoes_salvos TO service_role;

ALTER TABLE public.cartoes_salvos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cartoes_admin_all"    ON public.cartoes_salvos;
DROP POLICY IF EXISTS "cartoes_coord_select" ON public.cartoes_salvos;
DROP POLICY IF EXISTS "cartoes_self_select"  ON public.cartoes_salvos;
DROP POLICY IF EXISTS "cartoes_self_delete"  ON public.cartoes_salvos;
DROP POLICY IF EXISTS "cartoes_block_insert" ON public.cartoes_salvos;

CREATE POLICY "cartoes_admin_all"   ON public.cartoes_salvos FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "cartoes_coord_select" ON public.cartoes_salvos FOR SELECT
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "cartoes_self_select" ON public.cartoes_salvos FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));
CREATE POLICY "cartoes_self_delete" ON public.cartoes_salvos FOR DELETE
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));
CREATE POLICY "cartoes_block_insert" ON public.cartoes_salvos AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cartoes_salvos_updated_at ON public.cartoes_salvos;
CREATE TRIGGER trg_cartoes_salvos_updated_at
  BEFORE UPDATE ON public.cartoes_salvos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_cartoes_salvos ON public.cartoes_salvos;
CREATE TRIGGER trg_audit_cartoes_salvos
  AFTER INSERT OR UPDATE OR DELETE ON public.cartoes_salvos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 3. webhook_events_rede
CREATE TABLE IF NOT EXISTS public.webhook_events_rede (
  event_id     text PRIMARY KEY,
  payload      jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.webhook_events_rede TO service_role;

ALTER TABLE public.webhook_events_rede ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_admin_select" ON public.webhook_events_rede;
DROP POLICY IF EXISTS "webhook_block_direct" ON public.webhook_events_rede;
CREATE POLICY "webhook_admin_select" ON public.webhook_events_rede FOR SELECT
  USING (public.is_admin_role());
CREATE POLICY "webhook_block_direct" ON public.webhook_events_rede AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);

-- 4. Sanitização PCI
CREATE OR REPLACE FUNCTION public.fn_sanitize_rede_response(p_raw jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(p_raw, '{}'::jsonb)
    - 'cardNumber' - 'securityCode' - 'pan'
    - 'cvv' - 'cvv2' - 'track1' - 'track2'
    - 'cardholderName' - 'expirationMonth' - 'expirationYear';
$$;

-- 5. pagamentos_rede
CREATE TABLE IF NOT EXISTS public.pagamentos_rede (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id           uuid NOT NULL REFERENCES public.vendas(id),
  created_by         uuid REFERENCES auth.users(id),
  tid                text,
  nsu                text,
  authorization_code text,
  return_code        text,
  return_message     text,
  amount             integer NOT NULL,
  installments       smallint NOT NULL DEFAULT 1,
  kind               text NOT NULL DEFAULT 'credit',
  status             text NOT NULL DEFAULT 'pending',
  raw_response       jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pagamentos_rede IS
  'Auditoria de cobrancas via e-Rede. raw_response sanitizado. PCI-DSS SAQ-A.';

GRANT SELECT ON public.pagamentos_rede TO authenticated;
GRANT ALL ON public.pagamentos_rede TO service_role;

CREATE OR REPLACE FUNCTION public.fn_trigger_sanitize_pagamentos_rede()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_response IS NOT NULL THEN
    NEW.raw_response := public.fn_sanitize_rede_response(NEW.raw_response);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sanitize_pagamentos_rede ON public.pagamentos_rede;
CREATE TRIGGER trg_sanitize_pagamentos_rede
  BEFORE INSERT ON public.pagamentos_rede
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_sanitize_pagamentos_rede();

ALTER TABLE public.pagamentos_rede ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pgrede_admin_all"    ON public.pagamentos_rede;
DROP POLICY IF EXISTS "pgrede_coord_select" ON public.pagamentos_rede;
DROP POLICY IF EXISTS "pgrede_block_direct" ON public.pagamentos_rede;
CREATE POLICY "pgrede_admin_all"    ON public.pagamentos_rede FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "pgrede_coord_select" ON public.pagamentos_rede FOR SELECT
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "pgrede_block_direct" ON public.pagamentos_rede AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_audit_pagamentos_rede ON public.pagamentos_rede;
CREATE TRIGGER trg_audit_pagamentos_rede
  AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_rede
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 6. planos.cartao_token_id
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS cartao_token_id uuid
  REFERENCES public.cartoes_salvos(id) ON DELETE SET NULL;

-- 7. rate_limit_cobrancas
CREATE TABLE IF NOT EXISTS public.rate_limit_cobrancas (
  aluno_id   uuid    NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  janela_min bigint  NOT NULL,
  contagem   integer NOT NULL DEFAULT 1,
  PRIMARY KEY (aluno_id, janela_min)
);
GRANT ALL ON public.rate_limit_cobrancas TO service_role;
ALTER TABLE public.rate_limit_cobrancas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ratelimit_block_all" ON public.rate_limit_cobrancas;
CREATE POLICY "ratelimit_block_all" ON public.rate_limit_cobrancas AS RESTRICTIVE FOR ALL
  TO anon, authenticated USING (false) WITH CHECK (false);

-- 8. Rate limit function
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(p_aluno_id uuid, p_janela bigint, p_limite int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.rate_limit_cobrancas(aluno_id, janela_min, contagem)
  VALUES (p_aluno_id, p_janela, 1)
  ON CONFLICT (aluno_id, janela_min) DO UPDATE
    SET contagem = rate_limit_cobrancas.contagem + 1;
  SELECT contagem INTO v_count FROM public.rate_limit_cobrancas
  WHERE aluno_id = p_aluno_id AND janela_min = p_janela;
  RETURN v_count <= p_limite;
END; $$;

-- 9. Índices
CREATE INDEX IF NOT EXISTS pagamentos_rede_venda_idx  ON public.pagamentos_rede(venda_id);
CREATE INDEX IF NOT EXISTS pagamentos_rede_status_idx ON public.pagamentos_rede(status);
CREATE INDEX IF NOT EXISTS cartoes_salvos_aluno_idx   ON public.cartoes_salvos(aluno_id) WHERE ativo = true;

-- 10. Vault secrets (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'rede_pv') THEN
    PERFORM vault.create_secret('96337443', 'rede_pv', 'PV sandbox e-Rede Fortem');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'rede_token') THEN
    PERFORM vault.create_secret('f0e76c91722047ca97ab2c4d53af4d71f0e76c91722047ca97ab2c4d53af4d71', 'rede_token', 'Token sandbox e-Rede Fortem');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'rede_ambiente') THEN
    PERFORM vault.create_secret('sandbox', 'rede_ambiente', 'Ambiente e-Rede (sandbox|producao)');
  END IF;
END $$;

-- 11. pg_cron cleanup
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup') THEN
    PERFORM cron.schedule('rate-limit-cleanup', '*/30 * * * *',
      $cron$DELETE FROM public.rate_limit_cobrancas WHERE janela_min < EXTRACT(EPOCH FROM now())::bigint/60 - 60$cron$);
  END IF;
END $$;