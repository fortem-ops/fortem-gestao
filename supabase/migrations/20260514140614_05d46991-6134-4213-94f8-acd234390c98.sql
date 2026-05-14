
-- Configuração: novos limites
ALTER TABLE public.ponto_configuracoes
  ADD COLUMN IF NOT EXISTS tolerancia_marcacao_min int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tolerancia_diaria_min int NOT NULL DEFAULT 10;

-- Status do dia
DO $$ BEGIN
  CREATE TYPE public.ponto_status_dia AS ENUM (
    'dentro_tolerancia','divergencia_leve','divergencia_considerada',
    'banco_negativo','hora_extra','jornada_incompleta','falta_marcacao','em_analise'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Jornadas: novos campos
ALTER TABLE public.ponto_jornadas
  ADD COLUMN IF NOT EXISTS prev_entrada timestamptz,
  ADD COLUMN IF NOT EXISTS prev_saida timestamptz,
  ADD COLUMN IF NOT EXISTS prev_intervalo_min int,
  ADD COLUMN IF NOT EXISTS divergencia_entrada_min int,
  ADD COLUMN IF NOT EXISTS divergencia_saida_min int,
  ADD COLUMN IF NOT EXISTS divergencia_intervalo_min int,
  ADD COLUMN IF NOT EXISTS divergencia_total_dia int,
  ADD COLUMN IF NOT EXISTS minutos_tolerados int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutos_considerados int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutos_descontaveis int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutos_extras_validos int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tolerancia_excedida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_ponto public.ponto_status_dia;

-- Função núcleo
CREATE OR REPLACE FUNCTION public.fn_ponto_calcular_divergencias(_jornada_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _j public.ponto_jornadas;
  _cfg record;
  _h record;
  _dow int;
  _prev_entrada timestamptz;
  _prev_saida timestamptz;
  _prev_int_min int;
  _div_e int := 0;
  _div_s int := 0;
  _div_i int := 0;
  _max_abs int := 0;
  _soma_abs int := 0;
  _tol_marc int;
  _tol_dia int;
  _excedida boolean := false;
  _descont int := 0;
  _extras int := 0;
  _tolerados int := 0;
  _status public.ponto_status_dia;
BEGIN
  SELECT * INTO _j FROM public.ponto_jornadas WHERE id = _jornada_id;
  IF _j IS NULL THEN RETURN; END IF;

  SELECT tolerancia_marcacao_min, tolerancia_diaria_min INTO _cfg
  FROM public.ponto_configuracoes
  WHERE usuario_id = _j.usuario_id OR usuario_id IS NULL
  ORDER BY usuario_id NULLS LAST LIMIT 1;
  _tol_marc := COALESCE(_cfg.tolerancia_marcacao_min, 5);
  _tol_dia  := COALESCE(_cfg.tolerancia_diaria_min, 10);

  _dow := EXTRACT(DOW FROM _j.data)::int;
  SELECT horario_inicio, horario_fim, intervalo_min INTO _h
  FROM public.ponto_horarios_professor
  WHERE usuario_id = _j.usuario_id AND dia_semana = _dow AND ativo = true
  LIMIT 1;

  IF _h.horario_inicio IS NOT NULL THEN
    _prev_entrada := (_j.data::text || ' ' || _h.horario_inicio::text)::timestamptz;
    _prev_saida   := (_j.data::text || ' ' || _h.horario_fim::text)::timestamptz;
    _prev_int_min := COALESCE(_h.intervalo_min, 0);
  END IF;

  IF _prev_entrada IS NOT NULL AND _j.entrada IS NOT NULL THEN
    _div_e := ROUND(EXTRACT(EPOCH FROM (_j.entrada - _prev_entrada))/60)::int;
  END IF;
  IF _prev_saida IS NOT NULL AND _j.saida IS NOT NULL THEN
    _div_s := ROUND(EXTRACT(EPOCH FROM (_j.saida - _prev_saida))/60)::int;
  END IF;
  IF _prev_int_min IS NOT NULL AND _j.intervalo_inicio IS NOT NULL AND _j.intervalo_fim IS NOT NULL THEN
    _div_i := ROUND(EXTRACT(EPOCH FROM (_j.intervalo_fim - _j.intervalo_inicio))/60)::int - _prev_int_min;
  END IF;

  _max_abs := GREATEST(abs(_div_e), abs(_div_s), abs(_div_i));
  _soma_abs := abs(_div_e) + abs(_div_s) + abs(_div_i);

  IF _max_abs > _tol_marc OR _soma_abs > _tol_dia THEN
    _excedida := true;
    IF _div_e > 0 THEN _descont := _descont + _div_e; ELSIF _div_e < 0 THEN _extras := _extras + abs(_div_e); END IF;
    IF _div_s < 0 THEN _descont := _descont + abs(_div_s); ELSIF _div_s > 0 THEN _extras := _extras + _div_s; END IF;
    IF _div_i > 0 THEN _descont := _descont + _div_i; ELSIF _div_i < 0 THEN _extras := _extras + abs(_div_i); END IF;
    _tolerados := 0;
  ELSE
    _tolerados := _soma_abs;
  END IF;

  IF _j.entrada IS NULL THEN
    _status := 'falta_marcacao';
  ELSIF _j.saida IS NULL THEN
    _status := 'jornada_incompleta';
  ELSIF _excedida THEN
    IF _descont > 0 AND _extras = 0 THEN _status := 'banco_negativo';
    ELSIF _extras > 0 AND _descont = 0 THEN _status := 'hora_extra';
    ELSE _status := 'divergencia_considerada';
    END IF;
  ELSIF _soma_abs > 0 THEN
    _status := 'divergencia_leve';
  ELSE
    _status := 'dentro_tolerancia';
  END IF;

  UPDATE public.ponto_jornadas SET
    prev_entrada = _prev_entrada,
    prev_saida = _prev_saida,
    prev_intervalo_min = _prev_int_min,
    divergencia_entrada_min = _div_e,
    divergencia_saida_min = _div_s,
    divergencia_intervalo_min = _div_i,
    divergencia_total_dia = _soma_abs,
    minutos_tolerados = _tolerados,
    minutos_considerados = _descont + _extras,
    minutos_descontaveis = _descont,
    minutos_extras_validos = _extras,
    tolerancia_excedida = _excedida,
    status_ponto = _status
  WHERE id = _jornada_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ponto_consolidar_banco(_jornada_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _j public.ponto_jornadas;
BEGIN
  SELECT * INTO _j FROM public.ponto_jornadas WHERE id = _jornada_id;
  IF _j IS NULL OR _j.saida IS NULL OR NOT _j.tolerancia_excedida THEN RETURN; END IF;

  DELETE FROM public.ponto_banco_horas
   WHERE referencia_jornada_id = _jornada_id
     AND tipo IN ('tolerancia_excedida','hora_extra');

  IF _j.minutos_descontaveis > 0 THEN
    INSERT INTO public.ponto_banco_horas (usuario_id, data, minutos, motivo, tipo, registrado_por, referencia_jornada_id)
    VALUES (_j.usuario_id, _j.data, -_j.minutos_descontaveis,
            'Tolerância CLT excedida — desconto automático',
            'tolerancia_excedida', _j.usuario_id, _jornada_id);
  END IF;
  IF _j.minutos_extras_validos > 0 THEN
    INSERT INTO public.ponto_banco_horas (usuario_id, data, minutos, motivo, tipo, registrado_por, referencia_jornada_id)
    VALUES (_j.usuario_id, _j.data, _j.minutos_extras_validos,
            'Hora extra válida (tolerância excedida)',
            'hora_extra', _j.usuario_id, _jornada_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_ponto_recalcular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_ponto_calcular_divergencias(NEW.id);
  IF NEW.saida IS NOT NULL THEN
    PERFORM public.fn_ponto_consolidar_banco(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ponto_recalcular_after ON public.ponto_jornadas;
CREATE TRIGGER trg_ponto_recalcular_after
AFTER INSERT OR UPDATE OF entrada, intervalo_inicio, intervalo_fim, saida
ON public.ponto_jornadas
FOR EACH ROW EXECUTE FUNCTION public.trg_ponto_recalcular();

-- Backfill
DO $$ DECLARE _id uuid; BEGIN
  FOR _id IN SELECT id FROM public.ponto_jornadas LOOP
    PERFORM public.fn_ponto_calcular_divergencias(_id);
    PERFORM public.fn_ponto_consolidar_banco(_id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_calcular_divergencias(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_ponto_consolidar_banco(uuid) FROM PUBLIC, anon;
