
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
  _dist numeric;
  _user_nome text;
  _notif_id uuid;
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

  IF _fora THEN
    SELECT full_name INTO _user_nome FROM public.profiles WHERE user_id = _uid;
    INSERT INTO public.notificacoes (titulo, descricao, categoria, prioridade, tipo, criado_por)
    VALUES (
      'Ponto registrado fora do local',
      COALESCE(_user_nome, 'Colaborador') || ' bateu ponto (' || _tipo::text || ')' ||
      CASE
        WHEN _dist IS NOT NULL THEN ' a ' || round(_dist)::text || 'm de ' || COALESCE(_local.nome, 'local de trabalho')
        ELSE ' sem GPS disponível'
      END,
      'ponto'::notif_categoria,
      'media'::notif_prioridade,
      'simples'::notif_tipo,
      _uid
    ) RETURNING id INTO _notif_id;

    INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id, status)
    SELECT _notif_id, ur.user_id, 'nao_visualizada'::notif_dest_status
    FROM public.user_roles ur
    WHERE ur.role IN ('coordenador'::app_role, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'evento_id', _evento_id,
    'estado', public.fn_ponto_estado_atual(_uid),
    'fora_do_raio', _fora,
    'distancia_m', _dist,
    'local_nome', _local.nome
  );
END $function$;
