CREATE OR REPLACE FUNCTION public.fn_agendar_servico_equipe(p_aluno_id uuid, p_agenda_servico_id uuid, p_data date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _aluno_id uuid := p_aluno_id;
  _tpl record;
  _ocupado boolean;
  _plan_label text;
  _plano record;
  _base int := 0;
  _comprado int := 0;
  _usado int := 0;
  _plano_restante int := 0;
  _cred_disp int := 0;
  _novo_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;
  IF _aluno_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = _aluno_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_nao_encontrado');
  END IF;

  SELECT * INTO _tpl FROM public.agenda_servicos
  WHERE id = p_agenda_servico_id AND aluno_id IS NULL;
  IF _tpl.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_invalido');
  END IF;

  IF (p_data + _tpl.horario_inicio) <= (now() AT TIME ZONE 'America/Sao_Paulo') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_passado');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agenda_servicos
    WHERE profissional_id = _tpl.profissional_id
      AND data_especifica = p_data
      AND horario_inicio = _tpl.horario_inicio
      AND aluno_id IS NOT NULL
  ) INTO _ocupado;
  IF _ocupado THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_vaga');
  END IF;

  _plan_label := CASE _tpl.atividade
    WHEN 'Avaliação Funcional' THEN 'Avaliação Funcional'
    WHEN 'Nutrição'            THEN 'Consultas Nutrição'
    WHEN 'Reabilitação'        THEN 'Consultas Reabilitação'
    ELSE NULL
  END;

  IF _plan_label IS NOT NULL THEN
    SELECT * INTO _plano FROM public.fn_plano_principal_ativo(_aluno_id);
    IF _plano.id IS NOT NULL THEN
      SELECT COALESCE(MAX((regexp_match(s, '^(\d+)\s+(.+)$'))[1]::int), 0)
        INTO _base
      FROM unnest(_plano.servicos) AS s
      WHERE (regexp_match(s, '^(\d+)\s+(.+)$'))[2] = _plan_label;

      SELECT COALESCE(SUM(quantidade), 0) INTO _comprado
      FROM public.consumo_servicos
      WHERE aluno_id = _aluno_id AND plano_id = _plano.id
        AND tipo_servico = _plan_label AND tipo_registro = 'compra';

      SELECT COUNT(*) INTO _usado
      FROM public.consumo_servicos
      WHERE aluno_id = _aluno_id AND plano_id = _plano.id
        AND tipo_servico = _plan_label
        AND (agenda_id IS NOT NULL OR tipo_registro = 'uso_manual');

      _plano_restante := (_base + _comprado) - _usado;
    END IF;
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN ilimitado THEN 999999
         ELSE GREATEST(quantidade_inicial - quantidade_usada, 0) END), 0)
    INTO _cred_disp
  FROM public.creditos_aluno
  WHERE aluno_id = _aluno_id
    AND atividade = _tpl.atividade
    AND ativo = true
    AND (data_validade IS NULL OR data_validade >= CURRENT_DATE);

  IF COALESCE(_plano_restante, 0) <= 0 AND _cred_disp <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_creditos');
  END IF;

  INSERT INTO public.agenda_servicos
    (atividade, local, dia_semana, horario_inicio, horario_fim, tipo,
     data_especifica, profissional_id, aluno_id, observacoes)
  VALUES
    (_tpl.atividade, _tpl.local, EXTRACT(DOW FROM p_data)::int,
     _tpl.horario_inicio, _tpl.horario_fim, 'avulso',
     p_data, _tpl.profissional_id, _aluno_id, 'Agendado pela equipe')
  RETURNING id INTO _novo_id;

  IF _tpl.tipo = 'fixo' THEN
    BEGIN
      INSERT INTO public.agenda_servicos_excecoes (agenda_id, data_excecao)
      VALUES (_tpl.id, p_data);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  INSERT INTO public.system_logs (modulo, acao, mensagem, payload, user_id)
  VALUES ('agenda_servicos', 'agendamento_equipe', 'Serviço agendado pela equipe no perfil do aluno',
    jsonb_build_object('aluno_id', _aluno_id, 'agenda_id', _novo_id, 'horario_id', p_agenda_servico_id, 'data', p_data), auth.uid());

  RETURN jsonb_build_object('ok', true, 'id', _novo_id);
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM ILIKE '%sem créditos%' OR SQLERRM ILIKE '%plano ativo%' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_creditos');
  END IF;
  RETURN jsonb_build_object('ok', false, 'erro', 'erro_interno', 'detalhe', SQLERRM);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_agendar_servico_equipe(uuid,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_agendar_servico_equipe(uuid,uuid,date) TO authenticated;