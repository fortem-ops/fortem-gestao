
-- Remover criação de notificações de ponto

CREATE OR REPLACE FUNCTION public.fn_ponto_registrar(_tipo ponto_evento_tipo, _lat numeric DEFAULT NULL::numeric, _lng numeric DEFAULT NULL::numeric, _observacao text DEFAULT NULL::text, _dispositivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _hoje date := CURRENT_DATE;
  _now timestamptz := now();
  _jornada public.ponto_jornadas;
  _evento_id uuid;
  _local record;
  _fora boolean := false;
  _local_id uuid;
  _local_nome text;
  _dist numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO _jornada FROM public.ponto_jornadas WHERE usuario_id = _uid AND data = _hoje;

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

  IF _lat IS NOT NULL AND _lng IS NOT NULL THEN
    SELECT * INTO _local FROM public.fn_local_mais_proximo(_lat, _lng);
    IF FOUND THEN
      _local_id := _local.local_id;
      _local_nome := _local.nome;
      _dist := _local.distancia_m;
      _fora := NOT _local.dentro_raio;
    ELSE
      _fora := true;
    END IF;
  ELSE
    _fora := true;
  END IF;

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

  INSERT INTO public.ponto_eventos (usuario_id, jornada_id, tipo, data_hora, origem, latitude, longitude, dispositivo, observacao, fora_do_raio, local_mais_proximo_id, distancia_m)
  VALUES (_uid, _jornada.id, _tipo, _now, 'web', _lat, _lng, _dispositivo, _observacao, _fora, _local_id, _dist)
  RETURNING id INTO _evento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'evento_id', _evento_id,
    'estado', public.fn_ponto_estado_atual(_uid),
    'fora_do_raio', _fora,
    'distancia_m', _dist,
    'local_nome', _local_nome
  );
END $function$;

CREATE OR REPLACE FUNCTION public.fn_ponto_alertas_diarios()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_system_user uuid;
BEGIN
  SELECT user_id INTO v_system_user FROM user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  INSERT INTO audit_log (tabela, operacao, dados_depois, user_id)
  VALUES ('ponto_jornadas', 'cron_alertas_diarios_noop',
          jsonb_build_object('alertas_criados', 0, 'data', CURRENT_DATE, 'observacao', 'notificacoes de ponto desativadas'),
          v_system_user);

  RETURN jsonb_build_object('criadas', 0, 'data', CURRENT_DATE);
END;
$function$;

-- Limpar histórico existente
DELETE FROM public.notificacoes WHERE categoria = 'ponto';
