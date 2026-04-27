
-- ===== ENUMS =====
CREATE TYPE public.ponto_evento_tipo AS ENUM ('entrada','intervalo_inicio','intervalo_fim','saida');
CREATE TYPE public.ponto_jornada_status AS ENUM ('em_andamento','em_intervalo','encerrada','bloqueada');
CREATE TYPE public.ponto_origem AS ENUM ('web','mobile','ajuste_manual');
CREATE TYPE public.ponto_fechamento_status AS ENUM ('aberto','em_revisao','aprovado');

-- ===== TABLES =====
CREATE TABLE public.ponto_jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  data date NOT NULL,
  entrada timestamptz,
  intervalo_inicio timestamptz,
  intervalo_fim timestamptz,
  saida timestamptz,
  minutos_trabalhados int GENERATED ALWAYS AS (
    CASE
      WHEN entrada IS NOT NULL AND saida IS NOT NULL THEN
        GREATEST(
          0,
          (EXTRACT(EPOCH FROM (saida - entrada))/60)::int
          - CASE
              WHEN intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL
                THEN (EXTRACT(EPOCH FROM (intervalo_fim - intervalo_inicio))/60)::int
              ELSE 0
            END
        )
      ELSE NULL
    END
  ) STORED,
  minutos_intervalo int GENERATED ALWAYS AS (
    CASE
      WHEN intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL
        THEN (EXTRACT(EPOCH FROM (intervalo_fim - intervalo_inicio))/60)::int
      ELSE NULL
    END
  ) STORED,
  status public.ponto_jornada_status NOT NULL DEFAULT 'em_andamento',
  observacao text,
  fechamento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, data)
);

CREATE TABLE public.ponto_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  jornada_id uuid REFERENCES public.ponto_jornadas(id) ON DELETE SET NULL,
  tipo public.ponto_evento_tipo NOT NULL,
  data_hora timestamptz NOT NULL DEFAULT now(),
  origem public.ponto_origem NOT NULL DEFAULT 'web',
  latitude numeric,
  longitude numeric,
  dispositivo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_eventos_user_data ON public.ponto_eventos(usuario_id, data_hora DESC);
CREATE INDEX idx_ponto_eventos_jornada ON public.ponto_eventos(jornada_id);

CREATE TABLE public.ponto_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid UNIQUE,
  carga_diaria_min int NOT NULL DEFAULT 480,
  intervalo_minimo_min int NOT NULL DEFAULT 30,
  intervalo_obrigatorio boolean NOT NULL DEFAULT false,
  tolerancia_min int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Garantir um único registro global (usuario_id IS NULL)
CREATE UNIQUE INDEX uniq_ponto_config_global ON public.ponto_configuracoes ((usuario_id IS NULL)) WHERE usuario_id IS NULL;

CREATE TABLE public.ponto_fechamentos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  mes date NOT NULL,
  total_minutos int NOT NULL DEFAULT 0,
  minutos_extras int NOT NULL DEFAULT 0,
  minutos_faltantes int NOT NULL DEFAULT 0,
  pendencias_count int NOT NULL DEFAULT 0,
  status public.ponto_fechamento_status NOT NULL DEFAULT 'aberto',
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, mes)
);

ALTER TABLE public.ponto_jornadas
  ADD CONSTRAINT ponto_jornadas_fechamento_fk FOREIGN KEY (fechamento_id) REFERENCES public.ponto_fechamentos_mensais(id) ON DELETE SET NULL;

CREATE TABLE public.ponto_ajustes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid NOT NULL REFERENCES public.ponto_jornadas(id) ON DELETE CASCADE,
  usuario_alvo_id uuid NOT NULL,
  responsavel_id uuid NOT NULL,
  campo text NOT NULL,
  valor_antes text,
  valor_depois text,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_ajustes_jornada ON public.ponto_ajustes_log(jornada_id);

-- Seed da configuração global default
INSERT INTO public.ponto_configuracoes (usuario_id, carga_diaria_min, intervalo_minimo_min, intervalo_obrigatorio, tolerancia_min)
VALUES (NULL, 480, 30, false, 10);

-- ===== TRIGGERS DE updated_at =====
CREATE TRIGGER trg_updated_at_jornadas BEFORE UPDATE ON public.ponto_jornadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_config BEFORE UPDATE ON public.ponto_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_fechamentos BEFORE UPDATE ON public.ponto_fechamentos_mensais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bloquear edição de jornada que pertence a fechamento aprovado
CREATE OR REPLACE FUNCTION public.fn_ponto_bloquear_edicao_aprovado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _status public.ponto_fechamento_status;
BEGIN
  IF OLD.fechamento_id IS NOT NULL THEN
    SELECT status INTO _status FROM public.ponto_fechamentos_mensais WHERE id = OLD.fechamento_id;
    IF _status = 'aprovado' THEN
      RAISE EXCEPTION 'Jornada pertence a fechamento aprovado e não pode ser editada';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ponto_bloquear_edicao BEFORE UPDATE ON public.ponto_jornadas
  FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_bloquear_edicao_aprovado();

-- ===== RLS =====
ALTER TABLE public.ponto_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_fechamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_ajustes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Próprio ou coord/admin pode ver eventos" ON public.ponto_eventos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Usuário registra próprio evento" ON public.ponto_eventos FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Próprio ou coord/admin vê jornadas" ON public.ponto_jornadas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Próprio ou coord/admin insere jornadas" ON public.ponto_jornadas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin atualiza jornadas" ON public.ponto_jornadas FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Autenticados veem configurações" ON public.ponto_configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia configurações" ON public.ponto_configuracoes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Próprio ou coord/admin vê fechamentos" ON public.ponto_fechamentos_mensais FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin gerencia fechamentos" ON public.ponto_fechamentos_mensais FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Alvo ou coord/admin vê ajustes" ON public.ponto_ajustes_log FOR SELECT TO authenticated
  USING (usuario_alvo_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin insere ajustes" ON public.ponto_ajustes_log FOR INSERT TO authenticated
  WITH CHECK (responsavel_id = auth.uid() AND public.is_coordinator_or_admin(auth.uid()));

-- ===== FUNÇÕES =====

CREATE OR REPLACE FUNCTION public.fn_ponto_estado_atual(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _hoje date := CURRENT_DATE;
  _jornada record;
  _proxima text;
  _status text;
BEGIN
  SELECT * INTO _jornada FROM public.ponto_jornadas WHERE usuario_id = _uid AND data = _hoje;

  IF _jornada IS NULL OR _jornada.entrada IS NULL THEN
    _status := 'nao_iniciado'; _proxima := 'entrada';
  ELSIF _jornada.saida IS NOT NULL THEN
    _status := 'encerrada'; _proxima := NULL;
  ELSIF _jornada.intervalo_inicio IS NOT NULL AND _jornada.intervalo_fim IS NULL THEN
    _status := 'em_intervalo'; _proxima := 'intervalo_fim';
  ELSIF _jornada.intervalo_fim IS NOT NULL THEN
    _status := 'em_jornada'; _proxima := 'saida';
  ELSE
    _status := 'em_jornada'; _proxima := 'intervalo_inicio';
  END IF;

  RETURN jsonb_build_object(
    'status', _status,
    'proxima_acao', _proxima,
    'jornada_id', _jornada.id,
    'entrada', _jornada.entrada,
    'intervalo_inicio', _jornada.intervalo_inicio,
    'intervalo_fim', _jornada.intervalo_fim,
    'saida', _jornada.saida,
    'minutos_trabalhados', _jornada.minutos_trabalhados
  );
END $$;

CREATE OR REPLACE FUNCTION public.fn_ponto_registrar(
  _tipo public.ponto_evento_tipo,
  _lat numeric DEFAULT NULL,
  _lng numeric DEFAULT NULL,
  _observacao text DEFAULT NULL,
  _dispositivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _hoje date := CURRENT_DATE;
  _now timestamptz := now();
  _jornada public.ponto_jornadas;
  _evento_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO _jornada FROM public.ponto_jornadas WHERE usuario_id = _uid AND data = _hoje;

  -- Validações de transição
  IF _tipo = 'entrada' THEN
    IF _jornada IS NOT NULL AND _jornada.entrada IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe jornada iniciada hoje';
    END IF;
  ELSIF _tipo = 'intervalo_inicio' THEN
    IF _jornada IS NULL OR _jornada.entrada IS NULL THEN RAISE EXCEPTION 'Inicie a jornada antes do intervalo'; END IF;
    IF _jornada.intervalo_inicio IS NOT NULL AND _jornada.intervalo_fim IS NULL THEN RAISE EXCEPTION 'Já existe intervalo em andamento'; END IF;
    IF _jornada.intervalo_fim IS NOT NULL THEN RAISE EXCEPTION 'Intervalo já realizado hoje'; END IF;
    IF _jornada.saida IS NOT NULL THEN RAISE EXCEPTION 'Jornada já encerrada'; END IF;
  ELSIF _tipo = 'intervalo_fim' THEN
    IF _jornada IS NULL OR _jornada.intervalo_inicio IS NULL THEN RAISE EXCEPTION 'Não há intervalo em andamento'; END IF;
    IF _jornada.intervalo_fim IS NOT NULL THEN RAISE EXCEPTION 'Intervalo já finalizado'; END IF;
  ELSIF _tipo = 'saida' THEN
    IF _jornada IS NULL OR _jornada.entrada IS NULL THEN RAISE EXCEPTION 'Não é possível encerrar jornada não iniciada'; END IF;
    IF _jornada.saida IS NOT NULL THEN RAISE EXCEPTION 'Jornada já encerrada'; END IF;
    IF _jornada.intervalo_inicio IS NOT NULL AND _jornada.intervalo_fim IS NULL THEN RAISE EXCEPTION 'Finalize o intervalo antes de encerrar'; END IF;
  END IF;

  -- Cria/atualiza jornada do dia
  IF _jornada IS NULL THEN
    INSERT INTO public.ponto_jornadas (usuario_id, data, entrada, status)
    VALUES (_uid, _hoje, CASE WHEN _tipo='entrada' THEN _now END, 'em_andamento')
    RETURNING * INTO _jornada;
  ELSE
    UPDATE public.ponto_jornadas SET
      entrada = CASE WHEN _tipo='entrada' THEN _now ELSE entrada END,
      intervalo_inicio = CASE WHEN _tipo='intervalo_inicio' THEN _now ELSE intervalo_inicio END,
      intervalo_fim = CASE WHEN _tipo='intervalo_fim' THEN _now ELSE intervalo_fim END,
      saida = CASE WHEN _tipo='saida' THEN _now ELSE saida END,
      status = CASE
        WHEN _tipo='intervalo_inicio' THEN 'em_intervalo'::public.ponto_jornada_status
        WHEN _tipo='saida' THEN 'encerrada'::public.ponto_jornada_status
        ELSE 'em_andamento'::public.ponto_jornada_status
      END,
      updated_at = now()
    WHERE id = _jornada.id
    RETURNING * INTO _jornada;
  END IF;

  -- Insere evento
  INSERT INTO public.ponto_eventos (usuario_id, jornada_id, tipo, data_hora, origem, latitude, longitude, dispositivo, observacao)
  VALUES (_uid, _jornada.id, _tipo, _now, 'web', _lat, _lng, _dispositivo, _observacao)
  RETURNING id INTO _evento_id;

  RETURN jsonb_build_object('ok', true, 'evento_id', _evento_id, 'estado', public.fn_ponto_estado_atual(_uid));
END $$;

CREATE OR REPLACE FUNCTION public.fn_ponto_dashboard_coordenador(_data date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  WITH professores AS (
    SELECT ur.user_id, p.full_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'professor'
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
      CASE
        WHEN j.id IS NULL OR j.entrada IS NULL THEN 'nao_iniciou'
        WHEN j.saida IS NULL AND j.intervalo_inicio IS NOT NULL AND j.intervalo_fim IS NULL THEN 'em_intervalo'
        WHEN j.saida IS NOT NULL THEN 'encerrada'
        ELSE 'em_jornada'
      END AS status_calc
    FROM professores pr
    LEFT JOIN jornadas j ON j.usuario_id = pr.user_id
  )
  SELECT jsonb_build_object(
    'data', _data,
    'resumo', jsonb_build_object(
      'ativos', count(*) FILTER (WHERE status_calc = 'em_jornada'),
      'em_intervalo', count(*) FILTER (WHERE status_calc = 'em_intervalo'),
      'nao_iniciaram', count(*) FILTER (WHERE status_calc = 'nao_iniciou'),
      'encerradas', count(*) FILTER (WHERE status_calc = 'encerrada'),
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
      'status', status_calc
    ) ORDER BY full_name), '[]'::jsonb)
  ) INTO _result FROM combo;
  RETURN _result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ponto_ajustar_jornada(
  _jornada_id uuid, _campo text, _novo_valor timestamptz, _motivo text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _j public.ponto_jornadas;
  _antes text;
  _fechamento_status public.ponto_fechamento_status;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) < 3 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  IF _campo NOT IN ('entrada','intervalo_inicio','intervalo_fim','saida') THEN
    RAISE EXCEPTION 'Campo inválido';
  END IF;

  SELECT * INTO _j FROM public.ponto_jornadas WHERE id = _jornada_id FOR UPDATE;
  IF _j IS NULL THEN RAISE EXCEPTION 'Jornada não encontrada'; END IF;

  IF _j.fechamento_id IS NOT NULL THEN
    SELECT status INTO _fechamento_status FROM public.ponto_fechamentos_mensais WHERE id = _j.fechamento_id;
    IF _fechamento_status = 'aprovado' THEN RAISE EXCEPTION 'Fechamento aprovado — edição bloqueada'; END IF;
  END IF;

  _antes := CASE _campo
    WHEN 'entrada' THEN _j.entrada::text
    WHEN 'intervalo_inicio' THEN _j.intervalo_inicio::text
    WHEN 'intervalo_fim' THEN _j.intervalo_fim::text
    WHEN 'saida' THEN _j.saida::text
  END;

  EXECUTE format('UPDATE public.ponto_jornadas SET %I = $1, status = CASE WHEN $1 IS NOT NULL AND %L=''saida'' THEN ''encerrada''::public.ponto_jornada_status ELSE status END WHERE id = $2',
                 _campo, _campo)
    USING _novo_valor, _jornada_id;

  INSERT INTO public.ponto_ajustes_log (jornada_id, usuario_alvo_id, responsavel_id, campo, valor_antes, valor_depois, motivo)
  VALUES (_jornada_id, _j.usuario_id, auth.uid(), _campo, _antes, _novo_valor::text, _motivo);

  RETURN jsonb_build_object('ok', true);
END $$;

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
  _fechamento_id uuid;
  _existing_status public.ponto_fechamento_status;
BEGIN
  -- Carrega config (usuário > global)
  SELECT * INTO _config FROM public.ponto_configuracoes
  WHERE usuario_id = _user_id OR usuario_id IS NULL
  ORDER BY usuario_id NULLS LAST LIMIT 1;

  -- Se já existe fechamento aprovado, não recalcula
  SELECT id, status INTO _fechamento_id, _existing_status
  FROM public.ponto_fechamentos_mensais
  WHERE usuario_id = _user_id AND mes = _mes_inicio;
  IF _existing_status = 'aprovado' THEN
    RETURN jsonb_build_object('ok', true, 'ja_aprovado', true);
  END IF;

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

  _esperado := _dias_uteis * _config.carga_diaria_min;

  INSERT INTO public.ponto_fechamentos_mensais (usuario_id, mes, total_minutos, minutos_extras, minutos_faltantes, pendencias_count, status)
  VALUES (_user_id, _mes_inicio, _total, GREATEST(0, _total - _esperado), GREATEST(0, _esperado - _total), _pendencias, 'aberto')
  ON CONFLICT (usuario_id, mes) DO UPDATE SET
    total_minutos = EXCLUDED.total_minutos,
    minutos_extras = EXCLUDED.minutos_extras,
    minutos_faltantes = EXCLUDED.minutos_faltantes,
    pendencias_count = EXCLUDED.pendencias_count,
    updated_at = now()
  RETURNING id INTO _fechamento_id;

  RETURN jsonb_build_object('ok', true, 'fechamento_id', _fechamento_id, 'total_minutos', _total, 'pendencias', _pendencias);
END $$;

CREATE OR REPLACE FUNCTION public.fn_ponto_aprovar_fechamento(_fechamento_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _f record;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _f FROM public.ponto_fechamentos_mensais WHERE id = _fechamento_id;
  IF _f IS NULL THEN RAISE EXCEPTION 'Fechamento não encontrado'; END IF;
  IF _f.status = 'aprovado' THEN RAISE EXCEPTION 'Já aprovado'; END IF;

  -- Vincula todas as jornadas do mês
  UPDATE public.ponto_jornadas
  SET fechamento_id = _fechamento_id
  WHERE usuario_id = _f.usuario_id
    AND data BETWEEN _f.mes AND (_f.mes + interval '1 month - 1 day')::date;

  UPDATE public.ponto_fechamentos_mensais
  SET status = 'aprovado', aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  WHERE id = _fechamento_id;

  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_ponto_gerar_fechamentos_mes(_mes date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _user record;
  _coord record;
  _count int := 0;
  _label text;
BEGIN
  _label := to_char(date_trunc('month', _mes), 'MM/YYYY');

  FOR _user IN SELECT user_id FROM public.user_roles WHERE role = 'professor' LOOP
    PERFORM public.fn_ponto_calcular_fechamento(_user.user_id, _mes);
    _count := _count + 1;
  END LOOP;

  -- Cria tarefas para cada coordenador
  FOR _coord IN SELECT user_id FROM public.user_roles WHERE role IN ('coordenador','admin') LOOP
    INSERT INTO public.tarefas (titulo, descricao, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
    VALUES (
      'Fechamento de Ponto — ' || _label,
      'Revise as jornadas do mês, ajuste pendências e aprove o fechamento.',
      _coord.user_id, _coord.user_id,
      (date_trunc('month', _mes) + interval '1 month + 5 days')::date,
      'alta', true, 'ponto_fechamento'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'professores', _count, 'mes', _mes);
END $$;

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.ponto_eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ponto_jornadas;

-- ===== CRON: dia 1 de cada mês às 02:00, gera fechamento do mês anterior =====
SELECT cron.schedule(
  'ponto-fechamento-mensal',
  '0 2 1 * *',
  $$ SELECT public.fn_ponto_gerar_fechamentos_mes((date_trunc('month', now() - interval '1 day'))::date); $$
);
