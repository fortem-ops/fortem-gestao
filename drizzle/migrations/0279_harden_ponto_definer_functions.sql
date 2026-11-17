CREATE OR REPLACE FUNCTION public.fn_ponto_ajustar_jornada(_jornada_id uuid, _campo text, _novo_valor timestamp with time zone, _motivo text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _j public.ponto_jornadas;
  _antes text;
  _fechamento_status public.ponto_fechamento_status;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) < 3 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  IF _campo NOT IN ('entrada','intervalo_inicio','intervalo_fim','saida') THEN RAISE EXCEPTION 'Campo inválido'; END IF;

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

  IF _campo = 'entrada' THEN
    UPDATE public.ponto_jornadas SET entrada = _novo_valor WHERE id = _jornada_id;
  ELSIF _campo = 'intervalo_inicio' THEN
    UPDATE public.ponto_jornadas SET intervalo_inicio = _novo_valor WHERE id = _jornada_id;
  ELSIF _campo = 'intervalo_fim' THEN
    UPDATE public.ponto_jornadas SET intervalo_fim = _novo_valor WHERE id = _jornada_id;
  ELSE
    UPDATE public.ponto_jornadas SET saida = _novo_valor,
      status = CASE WHEN _novo_valor IS NOT NULL THEN 'encerrada'::public.ponto_jornada_status ELSE status END
    WHERE id = _jornada_id;
  END IF;

  INSERT INTO public.ponto_ajustes_log (jornada_id, usuario_alvo_id, responsavel_id, campo, valor_antes, valor_depois, motivo)
  VALUES (_jornada_id, _j.usuario_id, auth.uid(), _campo, _antes, _novo_valor::text, _motivo);

  RETURN jsonb_build_object('ok', true);
END $function$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_ajustar_jornada(uuid, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ponto_ajustar_jornada(uuid, text, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_fix_timezone_divergencias()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _count int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer role admin';
  END IF;

  PERFORM set_config('app.bypass_fechamento_lock', 'true', true);

  DELETE FROM public.ponto_banco_horas
  WHERE tipo IN ('tolerancia_excedida', 'hora_extra') AND referencia_jornada_id IS NOT NULL;

  SELECT COUNT(*) INTO _count FROM public.ponto_jornadas WHERE saida IS NOT NULL;
  PERFORM public.fn_ponto_calcular_divergencias(id) FROM public.ponto_jornadas WHERE saida IS NOT NULL;
  PERFORM public.fn_ponto_consolidar_banco(id) FROM public.ponto_jornadas WHERE saida IS NOT NULL;

  PERFORM set_config('app.bypass_fechamento_lock', 'false', true);
  RETURN 'ok:' || _count::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_fix_timezone_divergencias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_fix_timezone_divergencias() TO authenticated, service_role;