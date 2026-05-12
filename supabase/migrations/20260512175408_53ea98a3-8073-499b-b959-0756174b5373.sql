
-- ENUMS
CREATE TYPE public.plano_frequencia AS ENUM ('1x','2x','3x','livre');
CREATE TYPE public.venda_tipo AS ENUM ('plano','servico');
CREATE TYPE public.venda_status AS ENUM ('pendente','pago','cancelado');
CREATE TYPE public.credito_movimento_tipo AS ENUM ('compra','consumo','estorno','ajuste');

-- ============ CATALOGO PLANOS ============
CREATE TABLE public.planos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  periodo_meses INT NOT NULL DEFAULT 1,
  frequencia public.plano_frequencia NOT NULL DEFAULT '1x',
  quantidade_creditos INT,
  ilimitado BOOLEAN NOT NULL DEFAULT false,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.planos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_planos_view_all" ON public.planos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalogo_planos_admin_write" ON public.planos_catalogo FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_planos_catalogo_updated_at BEFORE UPDATE ON public.planos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed
INSERT INTO public.planos_catalogo (nome, periodo_meses, frequencia, quantidade_creditos, ilimitado, valor, cor) VALUES
('Start',           1, '1x',   4,  false, 0, '#9CA3AF'),
('Start+',          1, '2x',   8,  false, 0, '#F3F4F6'),
('Power',           1, '3x',  12,  false, 0, '#EF4444'),
('Pro',             1, 'livre', NULL, true, 0, '#111827'),
('Max',             12, 'livre', NULL, true, 0, '#7F1D1D'),
('Gympass/Wellhub', 1, 'livre', NULL, true, 0, '#8B5CF6'),
('Total Pass',      1, 'livre', NULL, true, 0, '#3B82F6');

-- ============ CATALOGO SERVICOS ============
CREATE TABLE public.servicos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  atividade TEXT NOT NULL,
  quantidade_sessoes INT NOT NULL DEFAULT 1,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.servicos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_servicos_view_all" ON public.servicos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalogo_servicos_admin_write" ON public.servicos_catalogo FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_servicos_catalogo_updated_at BEFORE UPDATE ON public.servicos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.servicos_catalogo (nome, atividade, quantidade_sessoes, valor) VALUES
('Nutrição',            'Nutrição',           4, 0),
('Reabilitação',        'Reabilitação',       4, 0),
('Avaliação Funcional', 'Avaliação Funcional',1, 0);

-- ============ CREDITOS ALUNO ============
CREATE TABLE public.creditos_aluno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  origem_tipo public.venda_tipo NOT NULL,
  origem_id UUID,
  atividade TEXT NOT NULL,
  quantidade_inicial INT NOT NULL DEFAULT 0,
  quantidade_usada INT NOT NULL DEFAULT 0,
  ilimitado BOOLEAN NOT NULL DEFAULT false,
  data_validade DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos_aluno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creditos_view" ON public.creditos_aluno FOR SELECT TO authenticated USING (
  public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND (a.responsavel_id = auth.uid() OR a.user_id = auth.uid()))
);
CREATE POLICY "creditos_admin_write" ON public.creditos_aluno FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_creditos_aluno_updated_at BEFORE UPDATE ON public.creditos_aluno
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_creditos_aluno ON public.creditos_aluno(aluno_id);

-- ============ CREDITOS MOVIMENTOS ============
CREATE TABLE public.creditos_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id UUID NOT NULL REFERENCES public.creditos_aluno(id) ON DELETE CASCADE,
  tipo public.credito_movimento_tipo NOT NULL,
  quantidade INT NOT NULL,
  agenda_id UUID,
  registrado_por UUID,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT
);
ALTER TABLE public.creditos_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_view" ON public.creditos_movimentos FOR SELECT TO authenticated USING (
  public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.creditos_aluno c
    JOIN public.alunos a ON a.id = c.aluno_id
    WHERE c.id = credito_id AND (a.responsavel_id = auth.uid() OR a.user_id = auth.uid())
  )
);
CREATE POLICY "mov_admin_write" ON public.creditos_movimentos FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

-- ============ VENDAS ============
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo public.venda_tipo NOT NULL,
  catalogo_id UUID NOT NULL,
  nome_snapshot TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  vendedor_id UUID,
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  status_pagamento public.venda_status NOT NULL DEFAULT 'pendente',
  plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_view" ON public.vendas FOR SELECT TO authenticated USING (
  public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND (a.responsavel_id = auth.uid() OR a.user_id = auth.uid()))
);
CREATE POLICY "vendas_insert" ON public.vendas FOR INSERT TO authenticated WITH CHECK (
  public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.responsavel_id = auth.uid())
);
CREATE POLICY "vendas_update" ON public.vendas FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "vendas_delete" ON public.vendas FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_vendas_updated_at BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendas_aluno ON public.vendas(aluno_id);

-- ============ TRIGGER: auto-gerar plano + creditos ao inserir venda ============
CREATE OR REPLACE FUNCTION public.fn_processar_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat_plano record;
  _cat_serv record;
  _novo_plano_id uuid;
  _credito_id uuid;
  _qtd int;
  _ilim bool;
BEGIN
  IF NEW.status_pagamento = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'plano' THEN
    SELECT * INTO _cat_plano FROM public.planos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_plano IS NULL THEN RAISE EXCEPTION 'Plano de catálogo não encontrado'; END IF;

    -- Desativa plano ativo anterior
    UPDATE public.planos SET ativo = false, data_fim = CURRENT_DATE
    WHERE aluno_id = NEW.aluno_id AND ativo = true;

    -- Constrói servicos array (mantém compatibilidade vazio)
    INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos)
    VALUES (NEW.aluno_id, _cat_plano.nome, NEW.data_venda, _cat_plano.periodo_meses, _cat_plano.valor, true, ARRAY[]::text[])
    RETURNING id INTO _novo_plano_id;

    NEW.plano_id := _novo_plano_id;

    -- Cria créditos de Treino
    _qtd := COALESCE(_cat_plano.quantidade_creditos, 0);
    _ilim := _cat_plano.ilimitado;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
    VALUES (NEW.aluno_id, 'plano', NEW.id, 'Treino', _qtd, _ilim,
            (NEW.data_venda + (_cat_plano.periodo_meses || ' months')::interval)::date)
    RETURNING id INTO _credito_id;

    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (_credito_id, 'compra', _qtd, NEW.vendedor_id, 'Plano: ' || _cat_plano.nome);

  ELSIF NEW.tipo = 'servico' THEN
    SELECT * INTO _cat_serv FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_serv IS NULL THEN RAISE EXCEPTION 'Serviço de catálogo não encontrado'; END IF;

    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
    VALUES (NEW.aluno_id, 'servico', NEW.id, _cat_serv.atividade, _cat_serv.quantidade_sessoes, false)
    RETURNING id INTO _credito_id;

    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (_credito_id, 'compra', _cat_serv.quantidade_sessoes, NEW.vendedor_id, 'Serviço: ' || _cat_serv.nome);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_vendas_processar
BEFORE INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.fn_processar_venda();
