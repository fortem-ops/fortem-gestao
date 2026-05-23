
-- ============ FASE 2 — JANELAS ============
CREATE OR REPLACE FUNCTION public.fn_ponto_janelas_dia(_usuario uuid, _data date)
RETURNS TABLE(
  tempo_trabalhado_min integer,
  tempo_ocioso_min integer,
  tempo_estabelecimento_min integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jornada record;
  v_aulas_min integer := 0;
BEGIN
  SELECT minutos_trabalhados, entrada, saida
    INTO v_jornada
  FROM public.ponto_jornadas
  WHERE usuario_id = _usuario AND data = _data
  LIMIT 1;

  IF v_jornada IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    EXTRACT(epoch FROM (a.horario_fim - a.horario_inicio)) / 60
  )::int, 0)
  INTO v_aulas_min
  FROM public.agenda_servicos a
  LEFT JOIN public.agenda_presencas p
    ON p.agenda_id = a.id AND p.data = _data
  WHERE a.profissional_id = _usuario
    AND (
      (a.tipo = 'fixo' AND a.dia_semana = EXTRACT(dow FROM _data)::int)
      OR (a.tipo = 'avulso' AND a.data_especifica = _data)
    )
    AND (p.comparecimento IS NULL OR p.comparecimento = true);

  RETURN QUERY SELECT
    LEAST(v_aulas_min, COALESCE(v_jornada.minutos_trabalhados, 0)),
    GREATEST(0, COALESCE(v_jornada.minutos_trabalhados, 0) - v_aulas_min),
    COALESCE(v_jornada.minutos_trabalhados, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_janelas_dia(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ponto_janelas_dia(uuid, date) TO authenticated;

-- ============ FASE 3 — SUBSTITUIÇÕES ============
DO $$ BEGIN
  CREATE TYPE public.ponto_subs_forma_pgto AS ENUM ('pagamento', 'banco_horas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ponto_subs_status AS ENUM ('pendente', 'aprovada', 'rejeitada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ponto_substituicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substituto_id uuid NOT NULL,
  substituido_id uuid NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  qtd_horas numeric(5,2) NOT NULL,
  valor_hora_aplicado numeric(10,2) NOT NULL DEFAULT 0,
  forma_pagamento public.ponto_subs_forma_pgto NOT NULL DEFAULT 'pagamento',
  motivo text NOT NULL,
  status public.ponto_subs_status NOT NULL DEFAULT 'pendente',
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subs_substituto ON public.ponto_substituicoes (substituto_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_subs_substituido ON public.ponto_substituicoes (substituido_id, data DESC);

ALTER TABLE public.ponto_substituicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_view_envolvidos_ou_coord" ON public.ponto_substituicoes
FOR SELECT TO authenticated
USING (
  substituto_id = auth.uid()
  OR substituido_id = auth.uid()
  OR is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "subs_insert_coord" ON public.ponto_substituicoes
FOR INSERT TO authenticated
WITH CHECK (is_coordinator_or_admin(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "subs_update_coord" ON public.ponto_substituicoes
FOR UPDATE TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "subs_delete_admin" ON public.ponto_substituicoes
FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

CREATE TRIGGER trg_subs_updated
BEFORE UPDATE ON public.ponto_substituicoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validação: limite 10h trabalhadas/dia somando jornada + substituições
CREATE OR REPLACE FUNCTION public.fn_validar_substituicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.qtd_horas > 8 THEN
    RAISE EXCEPTION 'Substituição não pode exceder 8h por evento';
  END IF;

  SELECT COALESCE(SUM(qtd_horas), 0) + NEW.qtd_horas INTO v_total
  FROM public.ponto_substituicoes
  WHERE substituto_id = NEW.substituto_id
    AND data = NEW.data
    AND status <> 'rejeitada'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_total > 10 THEN
    RAISE EXCEPTION 'Total de horas no dia (% h) excede o limite legal de 10h', v_total;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_substituicao
BEFORE INSERT OR UPDATE ON public.ponto_substituicoes
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_substituicao();

-- ============ FASE 4 — BANCO DE HORAS AVANÇADO ============
ALTER TYPE public.ponto_banco_tipo ADD VALUE IF NOT EXISTS 'vencimento';
ALTER TYPE public.ponto_banco_tipo ADD VALUE IF NOT EXISTS 'rescisao';
ALTER TYPE public.ponto_banco_tipo ADD VALUE IF NOT EXISTS 'substituicao';
ALTER TYPE public.ponto_banco_tipo ADD VALUE IF NOT EXISTS 'atividade_especial';

ALTER TABLE public.ponto_banco_horas
  ADD COLUMN IF NOT EXISTS competencia date,
  ADD COLUMN IF NOT EXISTS vencimento date,
  ADD COLUMN IF NOT EXISTS auditoria jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_banco_vencimento ON public.ponto_banco_horas (vencimento) WHERE vencimento IS NOT NULL;

-- ============ FASE 5 — ATIVIDADES ESPECIAIS ============
DO $$ BEGIN
  CREATE TYPE public.ponto_atv_forma_pgto AS ENUM ('pagamento', 'banco_horas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ponto_atividades_especiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  local text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ponto_atividades_especiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atv_view_auth" ON public.ponto_atividades_especiais
FOR SELECT TO authenticated USING (true);

CREATE POLICY "atv_manage_coord" ON public.ponto_atividades_especiais
FOR ALL TO authenticated
USING (is_coordinator_or_admin(auth.uid()))
WITH CHECK (is_coordinator_or_admin(auth.uid()) AND created_by = auth.uid());

CREATE TRIGGER trg_atv_updated
BEFORE UPDATE ON public.ponto_atividades_especiais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ponto_atividades_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.ponto_atividades_especiais(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  qtd_horas numeric(5,2) NOT NULL,
  valor_hora numeric(10,2) NOT NULL DEFAULT 0,
  forma_pagamento public.ponto_atv_forma_pgto NOT NULL DEFAULT 'pagamento',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atividade_id, usuario_id)
);

ALTER TABLE public.ponto_atividades_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atv_part_view" ON public.ponto_atividades_participantes
FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR is_coordinator_or_admin(auth.uid()));

CREATE POLICY "atv_part_manage_coord" ON public.ponto_atividades_participantes
FOR ALL TO authenticated
USING (is_coordinator_or_admin(auth.uid()))
WITH CHECK (is_coordinator_or_admin(auth.uid()));

-- Validação: máx 8h por participante por evento
CREATE OR REPLACE FUNCTION public.fn_validar_atv_participante()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.qtd_horas > 8 THEN
    RAISE EXCEPTION 'Máximo de 8 horas-aula por participante por evento';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_atv_participante
BEFORE INSERT OR UPDATE ON public.ponto_atividades_participantes
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_atv_participante();
