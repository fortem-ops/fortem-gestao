-- Adaptar links_cartao ao novo padrão
ALTER TABLE public.links_cartao
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'recepcao',
  ADD COLUMN IF NOT EXISTS usado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='links_cartao' AND column_name='expira_em') THEN
    ALTER TABLE public.links_cartao RENAME COLUMN expires_at TO expira_em;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='links_cartao' AND column_name='criado_por') THEN
    ALTER TABLE public.links_cartao RENAME COLUMN created_by TO criado_por;
  END IF;
END $$;

ALTER TABLE public.links_cartao
  ALTER COLUMN expira_em SET DEFAULT (now() + interval '24 hours');

ALTER TABLE public.links_cartao
  ALTER COLUMN token TYPE text USING token::text,
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'links_cartao_origem_check'
  ) THEN
    ALTER TABLE public.links_cartao
      ADD CONSTRAINT links_cartao_origem_check
      CHECK (origem IN ('portal_aluno','link_cadastro','recepcao'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'links_cartao_token_key'
  ) THEN
    ALTER TABLE public.links_cartao ADD CONSTRAINT links_cartao_token_key UNIQUE (token);
  END IF;
END $$;

COMMENT ON TABLE public.links_cartao IS
  'Links únicos de cadastro de cartão enviados ao aluno. Expiram em 24h e são invalidados após uso.';

CREATE INDEX IF NOT EXISTS links_cartao_token_idx ON public.links_cartao(token) WHERE NOT usado;
CREATE INDEX IF NOT EXISTS links_cartao_aluno_idx ON public.links_cartao(aluno_id);

ALTER TABLE public.links_cartao ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.links_cartao TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links_cartao TO authenticated;
GRANT ALL ON public.links_cartao TO service_role;

DROP POLICY IF EXISTS "links_cartao_admin_all" ON public.links_cartao;
CREATE POLICY "links_cartao_admin_all" ON public.links_cartao
  FOR ALL USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS "links_cartao_coord_insert" ON public.links_cartao;
CREATE POLICY "links_cartao_coord_insert" ON public.links_cartao
  FOR INSERT WITH CHECK (public.is_coordenador_ou_admin());

DROP POLICY IF EXISTS "links_cartao_coord_select" ON public.links_cartao;
CREATE POLICY "links_cartao_coord_select" ON public.links_cartao
  FOR SELECT USING (public.is_coordenador_ou_admin());

DROP POLICY IF EXISTS "links_cartao_public_token" ON public.links_cartao;
CREATE POLICY "links_cartao_public_token" ON public.links_cartao
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_audit_links_cartao ON public.links_cartao;
CREATE TRIGGER trg_audit_links_cartao
  AFTER INSERT OR UPDATE OR DELETE ON public.links_cartao
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();