
-- Enums
CREATE TYPE public.ponto_feriado_tipo AS ENUM ('nacional','estadual','municipal','facultativo','recesso');
CREATE TYPE public.ponto_ferias_tipo AS ENUM ('ferias','folga','atestado','licenca');

-- Tabela feriados
CREATE TABLE public.ponto_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  descricao text NOT NULL,
  tipo public.ponto_feriado_tipo NOT NULL DEFAULT 'nacional',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.ponto_feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem feriados" ON public.ponto_feriados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin gerencia feriados" ON public.ponto_feriados FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER ponto_feriados_updated_at BEFORE UPDATE ON public.ponto_feriados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela férias / folgas
CREATE TABLE public.ponto_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  tipo public.ponto_ferias_tipo NOT NULL DEFAULT 'ferias',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT ponto_ferias_periodo_valido CHECK (data_fim >= data_inicio)
);
CREATE INDEX idx_ponto_ferias_usuario_periodo ON public.ponto_ferias (usuario_id, data_inicio, data_fim);
ALTER TABLE public.ponto_ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem ferias" ON public.ponto_ferias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin gerencia ferias" ON public.ponto_ferias FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER ponto_ferias_updated_at BEFORE UPDATE ON public.ponto_ferias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas extras de fechamento
ALTER TABLE public.ponto_fechamentos_mensais
  ADD COLUMN IF NOT EXISTS dias_feriado int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_ferias int NOT NULL DEFAULT 0;

-- Função utilitária: motivo de ausência ('feriado' | 'ferias' | 'folga' | 'atestado' | 'licenca' | NULL)
CREATE OR REPLACE FUNCTION public.fn_ponto_dia_ausencia(_user_id uuid, _data date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT motivo FROM (
    SELECT 'feriado'::text AS motivo, 1 AS prio FROM public.ponto_feriados WHERE data = _data
    UNION ALL
    SELECT tipo::text AS motivo, 2 AS prio FROM public.ponto_ferias
      WHERE usuario_id = _user_id AND _data BETWEEN data_inicio AND data_fim
  ) x ORDER BY prio LIMIT 1;
$$;

-- Atualiza dashboard coordenador para incluir ausência justificada
CREATE OR REPLACE FUNCTION public.fn_ponto_dashboard_coordenador(_data date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  WITH colaboradores AS (
    SELECT DISTINCT ur.user_id, p.full_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role IN ('professor','admin')
  ),
  jornadas AS (
    SELECT j.* FROM public.ponto_jornadas j WHERE j.data = _data
  ),
  combo AS (
    SELECT
      pr.user_id,
      pr.full_name,
      j.id AS jornada_id,
      j.entrada, j.intervalo_inicio, j.intervalo_fim, j.saida,
      j.minutos_trabalhados, j.status,
      public.fn_ponto_dia_ausencia(pr.user_id, _data) AS motivo_ausencia,
      CASE
        WHEN public.fn_ponto_dia_ausencia(pr.user_id, _data) IS NOT NULL
             AND (j.id IS NULL OR j.entrada IS NULL) THEN 'ausente_justificado'
        WHEN j.id IS NULL OR j.entrada IS NULL THEN 'nao_iniciou'
        WHEN j.saida IS NULL AND j.intervalo_inicio IS NOT NULL AND j.intervalo_fim IS NULL THEN 'em_intervalo'
        WHEN j.saida IS NOT NULL THEN 'encerrada'
        ELSE 'em_jornada'
      END AS status_calc
    FROM colaboradores pr
    LEFT JOIN jornadas j ON j.usuario_id = pr.user_id
  )
  SELECT jsonb_build_object(
    'data', _data,
    'resumo', jsonb_build_object(
      'ativos', count(*) FILTER (WHERE status_calc = 'em_jornada'),
      'em_intervalo', count(*) FILTER (WHERE status_calc = 'em_intervalo'),
      'nao_iniciaram', count(*) FILTER (WHERE status_calc = 'nao_iniciou'),
      'encerradas', count(*) FILTER (WHERE status_calc = 'encerrada'),
      'ausencias_justificadas', count(*) FILTER (WHERE status_calc = 'ausente_justificado'),
      'inconsistencias', count(*) FILTER (WHERE entrada IS NOT NULL AND saida IS NULL AND _data < CURRENT_DATE)
    ),
    'professores', COALESCE(jsonb_agg(jsonb_build_object(
      'usuario_id', user_id,
      'nome', full_name,
      'jornada_id', jornada_id,
      'entrada', entrada,
      'intervalo_inicio', intervalo_inicio,
      'intervalo_fim', intervalo_fim,
      'saida', saida,
      'minutos_trabalhados', minutos_trabalhados,
      'status', status_calc,
      'motivo_ausencia', motivo_ausencia
    ) ORDER BY full_name), '[]'::jsonb)
  ) INTO _result FROM combo;
  RETURN _result;
END $$;

-- Atualiza fechamento para descontar feriados e férias
CREATE OR REPLACE FUNCTION public.fn_ponto_calcular_fechamento(_user_id uuid, _mes date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _mes_inicio date := date_trunc('month', _mes)::date;
  _mes_fim date := (date_trunc('month', _mes) + interval '1 month - 1 day')::date;
  _config record;
  _total int := 0;
  _esperado int := 0;
  _pendencias int := 0;
  _dias_uteis int := 0;
  _dias_previstos int := 0;
  _dias_feriado int := 0;
  _dias_ferias int := 0;
  _fechamento_id uuid;
  _existing_status public.ponto_fechamento_status;
  _d date;
  _dow int;
  _ausencia text;
  _h record;
BEGIN
  SELECT * INTO _config FROM public.ponto_configuracoes
  WHERE usuario_id = _user_id OR usuario_id IS NULL
  ORDER BY usuario_id NULLS LAST LIMIT 1;

  SELECT id, status INTO _fechamento_id, _existing_status
  FROM public.ponto_fechamentos_mensais
  WHERE usuario_id = _user_id AND mes = _mes_inicio;
  IF _existing_status = 'aprovado' THEN
    RETURN jsonb_build_object('ok', true, 'ja_aprovado', true);
  END IF;

  -- Conta dias previstos (com horário ativo) descontando feriados e férias
  FOR _d IN SELECT generate_series(_mes_inicio, _mes_fim, '1 day'::interval)::date LOOP
    _dow := EXTRACT(DOW FROM _d)::int;
    IF _dow = 0 THEN CONTINUE; END IF; -- domingo

    SELECT * INTO _h FROM public.ponto_horarios_professor
      WHERE usuario_id = _user_id AND dia_semana = _dow AND ativo = true;
    IF _h IS NULL THEN CONTINUE; END IF;

    _ausencia := public.fn_ponto_dia_ausencia(_user_id, _d);
    IF _ausencia = 'feriado' THEN
      _dias_feriado := _dias_feriado + 1;
      CONTINUE;
    ELSIF _ausencia IS NOT NULL THEN
      _dias_ferias := _dias_ferias + 1;
      CONTINUE;
    END IF;

    _dias_previstos := _dias_previstos + 1;
  END LOOP;

  SELECT
    COALESCE(SUM(minutos_trabalhados), 0),
    COUNT(*) FILTER (
      WHERE (entrada IS NOT NULL AND saida IS NULL)
         OR (_config.intervalo_obrigatorio AND (intervalo_inicio IS NULL OR intervalo_fim IS NULL))
         OR (intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL
             AND (EXTRACT(EPOCH FROM (intervalo_fim - intervalo_inicio))/60) < _config.intervalo_minimo_min)
    ),
    COUNT(*) FILTER (WHERE entrada IS NOT NULL)
  INTO _total, _pendencias, _dias_uteis
  FROM public.ponto_jornadas
  WHERE usuario_id = _user_id AND data BETWEEN _mes_inicio AND _mes_fim;

  _esperado := _dias_previstos * _config.carga_diaria_min;

  INSERT INTO public.ponto_fechamentos_mensais (usuario_id, mes, total_minutos, minutos_extras, minutos_faltantes, pendencias_count, status, dias_feriado, dias_ferias)
  VALUES (_user_id, _mes_inicio, _total, GREATEST(0, _total - _esperado), GREATEST(0, _esperado - _total), _pendencias, 'aberto', _dias_feriado, _dias_ferias)
  ON CONFLICT (usuario_id, mes) DO UPDATE SET
    total_minutos = EXCLUDED.total_minutos,
    minutos_extras = EXCLUDED.minutos_extras,
    minutos_faltantes = EXCLUDED.minutos_faltantes,
    pendencias_count = EXCLUDED.pendencias_count,
    dias_feriado = EXCLUDED.dias_feriado,
    dias_ferias = EXCLUDED.dias_ferias,
    updated_at = now()
  RETURNING id INTO _fechamento_id;

  RETURN jsonb_build_object('ok', true, 'fechamento_id', _fechamento_id, 'total_minutos', _total,
                            'pendencias', _pendencias, 'dias_feriado', _dias_feriado, 'dias_ferias', _dias_ferias);
END $$;
