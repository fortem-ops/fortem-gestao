CREATE OR REPLACE FUNCTION public.fn_admin_fix_timezone_divergencias()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $wrapper$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin';
  END IF;

  EXECUTE $inner$
    CREATE OR REPLACE FUNCTION public.fn_ponto_calcular_divergencias(_jornada_id uuid)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $func$
    DECLARE
      _j public.ponto_jornadas; _cfg record; _h record; _dow int;
      _prev_entrada timestamptz; _prev_saida timestamptz; _prev_int_min int;
      _div_e int := 0; _div_s int := 0; _div_i int := 0;
      _max_abs int := 0; _soma_abs int := 0; _tol_marc int; _tol_dia int;
      _excedida boolean := false; _descont int := 0; _extras int := 0;
      _tolerados int := 0; _status public.ponto_status_dia;
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
        WHERE usuario_id = _j.usuario_id AND dia_semana = _dow AND ativo = true LIMIT 1;
      IF _h.horario_inicio IS NOT NULL THEN
        _prev_entrada := (_j.data::text || ' ' || _h.horario_inicio::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';
        _prev_saida   := (_j.data::text || ' ' || _h.horario_fim::text)::timestamp  AT TIME ZONE 'America/Sao_Paulo';
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
      _max_abs  := GREATEST(abs(_div_e), abs(_div_s), abs(_div_i));
      _soma_abs := abs(_div_e) + abs(_div_s) + abs(_div_i);
      IF _max_abs > _tol_marc OR _soma_abs > _tol_dia THEN
        _excedida := true;
        IF _div_e > 0 THEN _descont := _descont + GREATEST(_div_e - _tol_marc, 0);
        ELSIF _div_e < 0 THEN _extras := _extras + GREATEST(abs(_div_e) - _tol_marc, 0); END IF;
        IF _div_s < 0 THEN _descont := _descont + GREATEST(abs(_div_s) - _tol_marc, 0);
        ELSIF _div_s > 0 THEN _extras := _extras + GREATEST(_div_s - _tol_marc, 0); END IF;
        IF _div_i > 0 THEN _descont := _descont + GREATEST(_div_i - _tol_marc, 0); END IF;
        _tolerados := 0;
      ELSE _tolerados := _soma_abs; END IF;
      IF _j.entrada IS NULL THEN _status := 'falta_marcacao';
      ELSIF _j.saida IS NULL THEN _status := 'jornada_incompleta';
      ELSIF _excedida THEN
        IF _descont > 0 AND _extras = 0 THEN _status := 'banco_negativo';
        ELSIF _extras > 0 AND _descont = 0 THEN _status := 'hora_extra';
        ELSE _status := 'divergencia_considerada'; END IF;
      ELSIF _soma_abs > 0 THEN _status := 'divergencia_leve';
      ELSE _status := 'dentro_tolerancia'; END IF;
      UPDATE public.ponto_jornadas SET
        prev_entrada = _prev_entrada, prev_saida = _prev_saida,
        prev_intervalo_min = _prev_int_min,
        divergencia_entrada_min = _div_e, divergencia_saida_min = _div_s,
        divergencia_intervalo_min = _div_i, divergencia_total_dia = _soma_abs,
        minutos_tolerados = _tolerados, minutos_considerados = _descont + _extras,
        minutos_descontaveis = _descont, minutos_extras_validos = _extras,
        tolerancia_excedida = _excedida, status_ponto = _status
      WHERE id = _jornada_id;
    END $func$
  $inner$;

  PERFORM public.fn_ponto_calcular_divergencias(id)
  FROM public.ponto_jornadas
  WHERE saida IS NOT NULL;

  DELETE FROM public.ponto_banco_horas
  WHERE tipo IN ('tolerancia_excedida', 'hora_extra')
    AND referencia_jornada_id IS NOT NULL;

  PERFORM public.fn_ponto_consolidar_banco(id)
  FROM public.ponto_jornadas
  WHERE saida IS NOT NULL;

  RETURN 'ok';
END;
$wrapper$;

REVOKE ALL ON FUNCTION public.fn_admin_fix_timezone_divergencias() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_fix_timezone_divergencias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_fix_timezone_divergencias() TO service_role;