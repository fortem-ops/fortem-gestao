
-- ─── CONFIGURAÇÕES GLOBAIS ───
CREATE TABLE public.clube_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.clube_config TO authenticated;
GRANT ALL ON public.clube_config TO service_role;
ALTER TABLE public.clube_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_clube_config" ON public.clube_config FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_clube_config" ON public.clube_config FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.clube_config (chave, valor, descricao) VALUES
  ('pontos_validade_meses', '12', 'Meses sem movimento para expirar pontos'),
  ('clima_cidade', 'Porto Alegre', 'Cidade para consulta climática'),
  ('clima_latitude', '-30.0331', 'Latitude para Open-Meteo'),
  ('clima_longitude', '-51.2300', 'Longitude para Open-Meteo'),
  ('clima_temp_frio_max', '15', 'Temperatura máxima (°C) para multiplicador frio'),
  ('clima_temp_calor_min', '33', 'Temperatura mínima (°C) para multiplicador calor'),
  ('clima_chuva_min_mm', '5', 'Precipitação mínima (mm) para multiplicador chuva'),
  ('clima_multiplicador', '1.5', 'Fator multiplicador em dias de clima extremo'),
  ('ranking_premio_mensal', 'Sessão grátis de nutrição', 'Prêmio para 1º lugar mensal'),
  ('ranking_premio_trimestral', '500 pontos bônus', 'Prêmio para 1º lugar trimestral');

-- ─── REGRAS DE PONTUAÇÃO ───
CREATE TABLE public.clube_regras_pontuacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL UNIQUE,
  label text NOT NULL,
  pontos integer NOT NULL DEFAULT 0,
  unica_vez boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clube_regras_pontuacao TO authenticated;
GRANT ALL ON public.clube_regras_pontuacao TO service_role;
ALTER TABLE public.clube_regras_pontuacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_regras" ON public.clube_regras_pontuacao FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_regras" ON public.clube_regras_pontuacao FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.clube_regras_pontuacao (acao, label, pontos, unica_vez) VALUES
  ('treino_realizado', 'Treino realizado', 10, false),
  ('avaliacao_funcional', 'Avaliação funcional realizada', 50, false),
  ('indicacao_convertida', 'Indicação convertida', 100, false),
  ('indicado_bonus', 'Bônus por ser indicado', 50, true),
  ('servico_contratado', 'Serviço contratado', 30, false),
  ('aniversario_aluno', 'Aniversário do aluno', 50, false),
  ('aniversario_fortem', 'Aniversário FORTEM (por ano)', 100, false),
  ('avaliacao_google', 'Avaliação no Google', 50, true),
  ('perfil_completo', 'Perfil completo no app', 20, true),
  ('ajuste_manual', 'Ajuste manual pela equipe', 0, false);

-- ─── SALDO ───
CREATE TABLE public.clube_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  total_acumulado integer NOT NULL DEFAULT 0,
  total_resgatado integer NOT NULL DEFAULT 0,
  saldo integer NOT NULL DEFAULT 0,
  nivel text NOT NULL DEFAULT 'iniciante',
  ultima_movimentacao timestamptz,
  pontos_expiram_em timestamptz,
  ranking_publico boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id)
);
GRANT SELECT ON public.clube_pontos TO authenticated;
GRANT ALL ON public.clube_pontos TO service_role;
ALTER TABLE public.clube_pontos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_clube_pontos" ON public.clube_pontos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_own_clube_pontos" ON public.clube_pontos FOR SELECT TO authenticated USING (aluno_id = public.fn_current_aluno_id());

-- ─── HISTÓRICO ───
CREATE TABLE public.clube_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  acao text NOT NULL,
  label text NOT NULL,
  pontos integer NOT NULL,
  multiplicador numeric(3,2) NOT NULL DEFAULT 1.0,
  pontos_final integer NOT NULL,
  multiplicador_clima boolean NOT NULL DEFAULT false,
  motivo_manual text,
  referencia_id uuid,
  referencia_tipo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clube_hist_aluno_data ON public.clube_historico (aluno_id, created_at DESC);
GRANT SELECT ON public.clube_historico TO authenticated;
GRANT ALL ON public.clube_historico TO service_role;
ALTER TABLE public.clube_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_historico" ON public.clube_historico FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_own_historico" ON public.clube_historico FOR SELECT TO authenticated USING (aluno_id = public.fn_current_aluno_id());

-- ─── BADGES ───
CREATE TABLE public.clube_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text NOT NULL,
  emoji text NOT NULL DEFAULT '🏅',
  criterio text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clube_badges TO authenticated;
GRANT ALL ON public.clube_badges TO service_role;
ALTER TABLE public.clube_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_badges" ON public.clube_badges FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_badges" ON public.clube_badges FOR SELECT TO authenticated USING (ativo = true AND auth.uid() IS NOT NULL);

INSERT INTO public.clube_badges (codigo, nome, descricao, emoji, criterio) VALUES
  ('primeiro_treino', 'Primeiro Passo', 'Realizou o primeiro treino na FORTEM', '🥇', 'treinos_realizados >= 1'),
  ('mes_completo', 'Mês Completo', 'Treinou em todas as semanas de um mês', '📅', 'semanas_consecutivas_mes >= 4'),
  ('sequencia_30', 'Sequência de Fogo', '30 dias consecutivos sem falta', '🔥', 'dias_consecutivos >= 30'),
  ('embaixador', 'Embaixador FORTEM', 'Indicou 3 ou mais alunos que contrataram', '🤝', 'indicacoes_convertidas >= 3'),
  ('evoluiu', 'Evolução Real', 'Melhorou seu score entre duas avaliações funcionais', '📊', 'melhora_avaliacao = true'),
  ('veterano', 'Veterano', 'Completou 1 ano na FORTEM', '🎂', 'anos_fortem >= 1'),
  ('lenda', 'Lenda FORTEM', 'Completou 2 ou mais anos na FORTEM', '🏆', 'anos_fortem >= 2'),
  ('guerreiro_chuva', 'Guerreiro da Chuva', 'Treinou em dia de clima extremo (multiplicador ativo)', '💧', 'treino_clima_extremo = true');

CREATE TABLE public.clube_aluno_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.clube_badges(id) ON DELETE CASCADE,
  conquistado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, badge_id)
);
GRANT SELECT ON public.clube_aluno_badges TO authenticated;
GRANT ALL ON public.clube_aluno_badges TO service_role;
ALTER TABLE public.clube_aluno_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_aluno_badges" ON public.clube_aluno_badges FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_own_badges" ON public.clube_aluno_badges FOR SELECT TO authenticated USING (aluno_id = public.fn_current_aluno_id());

-- ─── RECOMPENSAS ───
CREATE TABLE public.clube_recompensas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  custo_pontos integer NOT NULL,
  tipo text NOT NULL DEFAULT 'automatico' CHECK (tipo IN ('automatico', 'manual')),
  ativo boolean NOT NULL DEFAULT true,
  estoque integer,
  icone text DEFAULT '🎁',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clube_recompensas TO authenticated;
GRANT ALL ON public.clube_recompensas TO service_role;
ALTER TABLE public.clube_recompensas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_recompensas" ON public.clube_recompensas FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_recompensas" ON public.clube_recompensas FOR SELECT TO authenticated USING (ativo = true AND auth.uid() IS NOT NULL);

INSERT INTO public.clube_recompensas (nome, descricao, custo_pontos, tipo, icone) VALUES
  ('Sessão extra de treino', 'Uma sessão de treino adicional fora do seu plano', 150, 'automatico', '🏋️'),
  ('Desconto 20% em serviço', 'Desconto de 20% em qualquer serviço avulso', 200, 'manual', '💰'),
  ('Sessão de Nutrição grátis', 'Uma consulta de nutrição sem custo adicional', 400, 'manual', '🥗'),
  ('Sessão de Reabilitação grátis', 'Uma sessão de fisioterapia sem custo adicional', 400, 'manual', '💆'),
  ('Brinde FORTEM', 'Kit com produtos FORTEM (squeeze, toalha, etc.)', 300, 'manual', '🎁'),
  ('Upgrade de frequência por 1 mês', 'Treine uma vez a mais por semana durante 30 dias', 500, 'manual', '⬆️');

-- ─── RESGATES ───
CREATE TABLE public.clube_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  recompensa_id uuid NOT NULL REFERENCES public.clube_recompensas(id),
  pontos_utilizados integer NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'entregue', 'cancelado')),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.clube_resgates TO authenticated;
GRANT ALL ON public.clube_resgates TO service_role;
ALTER TABLE public.clube_resgates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_resgates" ON public.clube_resgates FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_own_resgates" ON public.clube_resgates FOR SELECT TO authenticated USING (aluno_id = public.fn_current_aluno_id());

-- ─── CLIMA ───
CREATE TABLE public.clube_clima_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  temperatura_max numeric(5,2),
  temperatura_min numeric(5,2),
  precipitacao_mm numeric(6,2),
  multiplicador_ativo boolean NOT NULL DEFAULT false,
  motivo text,
  consultado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clube_clima_cache TO authenticated;
GRANT ALL ON public.clube_clima_cache TO service_role;
ALTER TABLE public.clube_clima_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_clima" ON public.clube_clima_cache FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_clima" ON public.clube_clima_cache FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── INDICAÇÕES ───
CREATE TABLE public.clube_indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  padrinho_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  indicado_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  codigo text NOT NULL UNIQUE DEFAULT substring(gen_random_uuid()::text, 1, 8),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'convertido', 'expirado')),
  convertido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clube_indic_padrinho ON public.clube_indicacoes (padrinho_id);
CREATE INDEX idx_clube_indic_codigo ON public.clube_indicacoes (codigo);
GRANT SELECT ON public.clube_indicacoes TO authenticated;
GRANT ALL ON public.clube_indicacoes TO service_role;
ALTER TABLE public.clube_indicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_indicacoes" ON public.clube_indicacoes FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_own_indicacoes" ON public.clube_indicacoes FOR SELECT TO authenticated USING (padrinho_id = public.fn_current_aluno_id());

-- ─── RANKING ───
CREATE TABLE public.clube_ranking_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo text NOT NULL CHECK (periodo IN ('mensal', 'trimestral', 'semestral', 'anual')),
  referencia text NOT NULL,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  pontos_periodo integer NOT NULL DEFAULT 0,
  posicao integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(periodo, referencia, aluno_id)
);
GRANT SELECT ON public.clube_ranking_snapshots TO authenticated;
GRANT ALL ON public.clube_ranking_snapshots TO service_role;
ALTER TABLE public.clube_ranking_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_ranking" ON public.clube_ranking_snapshots FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_ranking" ON public.clube_ranking_snapshots FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── RPC: ADICIONAR PONTOS ───
CREATE OR REPLACE FUNCTION public.fn_clube_adicionar_pontos(
  p_aluno_id uuid,
  p_acao text,
  p_referencia_id uuid DEFAULT NULL,
  p_referencia_tipo text DEFAULT NULL,
  p_motivo_manual text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_pontos_manual integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _regra clube_regras_pontuacao%ROWTYPE;
  _clima clube_clima_cache%ROWTYPE;
  _config_mult text;
  _multiplicador numeric(3,2) := 1.0;
  _pontos_base integer;
  _pontos_final integer;
  _saldo_atual integer;
  _validade_meses integer;
BEGIN
  SELECT * INTO _regra FROM clube_regras_pontuacao WHERE acao = p_acao AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'regra_nao_encontrada');
  END IF;

  _pontos_base := _regra.pontos;

  IF p_acao = 'ajuste_manual' AND p_pontos_manual IS NOT NULL THEN
    _pontos_base := p_pontos_manual;
  END IF;

  IF _regra.unica_vez THEN
    IF EXISTS (SELECT 1 FROM clube_historico WHERE aluno_id = p_aluno_id AND acao = p_acao) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'acao_ja_realizada');
    END IF;
  END IF;

  SELECT * INTO _clima FROM clube_clima_cache WHERE data = CURRENT_DATE;
  IF FOUND AND _clima.multiplicador_ativo AND p_acao = 'treino_realizado' THEN
    SELECT valor INTO _config_mult FROM clube_config WHERE chave = 'clima_multiplicador';
    _multiplicador := COALESCE(_config_mult::numeric, 1.5);
  END IF;

  _pontos_final := ROUND(_pontos_base * _multiplicador);

  SELECT valor::integer INTO _validade_meses FROM clube_config WHERE chave = 'pontos_validade_meses';
  _validade_meses := COALESCE(_validade_meses, 12);

  INSERT INTO clube_pontos (aluno_id, total_acumulado, saldo, ultima_movimentacao, pontos_expiram_em, nivel)
  VALUES (
    p_aluno_id,
    GREATEST(_pontos_final, 0),
    GREATEST(_pontos_final, 0),
    now(),
    now() + (_validade_meses || ' months')::interval,
    CASE
      WHEN _pontos_final >= 3000 THEN 'elite'
      WHEN _pontos_final >= 1000 THEN 'comprometido'
      WHEN _pontos_final >= 300 THEN 'dedicado'
      ELSE 'iniciante'
    END
  )
  ON CONFLICT (aluno_id) DO UPDATE SET
    total_acumulado = clube_pontos.total_acumulado + GREATEST(_pontos_final, 0),
    saldo = clube_pontos.saldo + _pontos_final,
    ultima_movimentacao = now(),
    pontos_expiram_em = now() + (_validade_meses || ' months')::interval,
    nivel = CASE
      WHEN clube_pontos.saldo + _pontos_final >= 3000 THEN 'elite'
      WHEN clube_pontos.saldo + _pontos_final >= 1000 THEN 'comprometido'
      WHEN clube_pontos.saldo + _pontos_final >= 300 THEN 'dedicado'
      ELSE 'iniciante'
    END,
    updated_at = now()
  RETURNING saldo INTO _saldo_atual;

  INSERT INTO clube_historico (
    aluno_id, acao, label, pontos, multiplicador, pontos_final,
    multiplicador_clima, motivo_manual, referencia_id, referencia_tipo, created_by
  ) VALUES (
    p_aluno_id, p_acao, _regra.label, _pontos_base, _multiplicador, _pontos_final,
    (_multiplicador > 1.0), p_motivo_manual, p_referencia_id, p_referencia_tipo, p_created_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pontos_adicionados', _pontos_final,
    'multiplicador', _multiplicador,
    'multiplicador_clima', (_multiplicador > 1.0),
    'saldo_atual', _saldo_atual
  );
END;
$$;

-- ─── RPC: RESGATAR ───
CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno_id uuid;
  _recompensa clube_recompensas%ROWTYPE;
  _pontos clube_pontos%ROWTYPE;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida');
  END IF;

  SELECT * INTO _pontos FROM clube_pontos WHERE aluno_id = _aluno_id;
  IF NOT FOUND OR _pontos.saldo < _recompensa.custo_pontos THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'saldo_insuficiente', 'saldo', COALESCE(_pontos.saldo, 0));
  END IF;

  UPDATE clube_pontos SET
    saldo = saldo - _recompensa.custo_pontos,
    total_resgatado = total_resgatado + _recompensa.custo_pontos,
    updated_at = now()
  WHERE aluno_id = _aluno_id;

  INSERT INTO clube_resgates (aluno_id, recompensa_id, pontos_utilizados, status)
  VALUES (_aluno_id, p_recompensa_id, _recompensa.custo_pontos,
    CASE WHEN _recompensa.tipo = 'automatico' THEN 'aprovado' ELSE 'pendente' END);

  INSERT INTO clube_historico (aluno_id, acao, label, pontos, pontos_final, created_by)
  VALUES (_aluno_id, 'resgate', 'Resgate: ' || _recompensa.nome, -_recompensa.custo_pontos, -_recompensa.custo_pontos, auth.uid());

  RETURN jsonb_build_object('ok', true, 'tipo', _recompensa.tipo, 'recompensa', _recompensa.nome);
END;
$$;
