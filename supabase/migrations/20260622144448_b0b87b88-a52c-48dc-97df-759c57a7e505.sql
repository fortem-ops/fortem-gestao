
-- ============================================================
-- Pix Automático Banco Inter (Jornada 1)
-- ============================================================

-- 1) inter_tokens (acesso apenas pelo backend)
CREATE TABLE public.inter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.inter_tokens TO service_role;
ALTER TABLE public.inter_tokens ENABLE ROW LEVEL SECURITY;
-- Sem policies: somente service_role acessa (RLS bypass).

CREATE INDEX idx_inter_tokens_expires_at ON public.inter_tokens(expires_at DESC);

-- 2) pix_recorrencias
CREATE TABLE public.pix_recorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  id_rec TEXT UNIQUE NOT NULL,
  id_solic_rec TEXT,
  status TEXT NOT NULL DEFAULT 'CRIADA',
  valor_minimo NUMERIC(10,2) NOT NULL,
  periodicidade TEXT NOT NULL DEFAULT 'MENSAL',
  data_inicio DATE NOT NULL,
  data_fim DATE,
  politica_retentativa TEXT NOT NULL DEFAULT 'PERMITE_3R_7D',
  motivo_cancelamento TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_recorrencias TO authenticated;
GRANT ALL ON public.pix_recorrencias TO service_role;
ALTER TABLE public.pix_recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/coord can view pix_recorrencias"
  ON public.pix_recorrencias FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY "Admin/coord can insert pix_recorrencias"
  ON public.pix_recorrencias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY "Admin/coord can update pix_recorrencias"
  ON public.pix_recorrencias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY "Admin/coord can delete pix_recorrencias"
  ON public.pix_recorrencias FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE INDEX idx_pix_rec_aluno ON public.pix_recorrencias(aluno_id);
CREATE INDEX idx_pix_rec_status ON public.pix_recorrencias(status);

-- 3) pix_cobrancas
CREATE TABLE public.pix_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_rec TEXT NOT NULL REFERENCES public.pix_recorrencias(id_rec) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  txid TEXT UNIQUE NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'CRIADA',
  descricao TEXT,
  pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  motivo_rejeicao TEXT,
  liquidado_em TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_cobrancas TO authenticated;
GRANT ALL ON public.pix_cobrancas TO service_role;
ALTER TABLE public.pix_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/coord can view pix_cobrancas"
  ON public.pix_cobrancas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY "Admin/coord can insert pix_cobrancas"
  ON public.pix_cobrancas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY "Admin/coord can update pix_cobrancas"
  ON public.pix_cobrancas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY "Admin/coord can delete pix_cobrancas"
  ON public.pix_cobrancas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE INDEX idx_pix_cob_aluno ON public.pix_cobrancas(aluno_id);
CREATE INDEX idx_pix_cob_idrec ON public.pix_cobrancas(id_rec);
CREATE INDEX idx_pix_cob_status ON public.pix_cobrancas(status);

-- 4) triggers updated_at (função public.update_updated_at_column já existe no projeto)
CREATE TRIGGER trg_pix_rec_updated
  BEFORE UPDATE ON public.pix_recorrencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_pix_cob_updated
  BEFORE UPDATE ON public.pix_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
