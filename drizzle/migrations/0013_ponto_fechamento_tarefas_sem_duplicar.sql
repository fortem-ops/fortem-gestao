CREATE OR REPLACE FUNCTION public.fn_ponto_gerar_fechamentos_mes(_mes date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user record;
  _coord record;
  _count int := 0;
  _label text;
  _inicio date := date_trunc('month', _mes)::date;
  _fim date := (date_trunc('month', _mes) + interval '1 month - 1 day')::date;
  _pendentes int := 0;
BEGIN
  _label := to_char(_inicio, 'MM/YYYY');

  FOR _user IN
    SELECT DISTINCT u.user_id FROM (
      SELECT user_id FROM public.user_roles WHERE role = 'professor'
      UNION
      SELECT usuario_id FROM public.ponto_horarios_professor WHERE ativo
      UNION
      SELECT usuario_id FROM public.ponto_jornadas
        WHERE data >= _inicio AND data <= _fim
    ) u
  LOOP
    PERFORM public.fn_ponto_calcular_fechamento(_user.user_id, _mes);
    _count := _count + 1;
  END LOOP;

  SELECT count(*) INTO _pendentes
  FROM public.ponto_fechamentos_mensais
  WHERE mes = _inicio AND status <> 'aprovado';

  IF _pendentes = 0 THEN
    DELETE FROM public.tarefas
    WHERE tipo_auto = 'ponto_fechamento'
      AND titulo = 'Fechamento de Ponto — ' || _label
      AND status <> 'concluida';

    RETURN jsonb_build_object('ok', true, 'professores', _count, 'mes', _mes, 'tarefas', 0);
  END IF;

  FOR _coord IN SELECT user_id FROM public.user_roles WHERE role IN ('coordenador','admin') LOOP
    INSERT INTO public.tarefas (titulo, descricao, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
    SELECT
      'Fechamento de Ponto — ' || _label,
      'Revise as jornadas do mês, ajuste pendências e aprove o fechamento.',
      _coord.user_id, _coord.user_id,
      (_inicio + interval '1 month + 5 days')::date,
      'alta', true, 'ponto_fechamento'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.tipo_auto = 'ponto_fechamento'
        AND t.responsavel_id = _coord.user_id
        AND t.titulo = 'Fechamento de Ponto — ' || _label
        AND t.status <> 'concluida'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'professores', _count, 'mes', _mes);
END
$function$;

CREATE OR REPLACE FUNCTION public.fn_ponto_aprovar_fechamento(_fechamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _f record;
  _pendentes int := 0;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _f FROM public.ponto_fechamentos_mensais WHERE id = _fechamento_id;
  IF _f IS NULL THEN RAISE EXCEPTION 'Fechamento não encontrado'; END IF;
  IF _f.status = 'aprovado' THEN RAISE EXCEPTION 'Já aprovado'; END IF;

  UPDATE public.ponto_jornadas
  SET fechamento_id = _fechamento_id
  WHERE usuario_id = _f.usuario_id
    AND data BETWEEN _f.mes AND (_f.mes + interval '1 month - 1 day')::date;

  UPDATE public.ponto_fechamentos_mensais
  SET status = 'aprovado', aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  WHERE id = _fechamento_id;

  SELECT count(*) INTO _pendentes
  FROM public.ponto_fechamentos_mensais
  WHERE mes = _f.mes AND status <> 'aprovado';

  IF _pendentes = 0 THEN
    DELETE FROM public.tarefas
    WHERE tipo_auto = 'ponto_fechamento'
      AND titulo = 'Fechamento de Ponto — ' || to_char(_f.mes, 'MM/YYYY')
      AND status <> 'concluida';
  END IF;

  RETURN jsonb_build_object('ok', true);
END $function$;