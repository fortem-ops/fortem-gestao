CREATE OR REPLACE FUNCTION public.fn_ponto_consolidar_banco(_jornada_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _j public.ponto_jornadas;
BEGIN
  SELECT * INTO _j FROM public.ponto_jornadas WHERE id = _jornada_id;
  IF _j IS NULL THEN RETURN; END IF;

  DELETE FROM public.ponto_banco_horas
   WHERE referencia_jornada_id = _jornada_id
     AND tipo IN ('tolerancia_excedida','hora_extra');

  IF _j.saida IS NULL OR NOT _j.tolerancia_excedida THEN RETURN; END IF;

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
END $function$;