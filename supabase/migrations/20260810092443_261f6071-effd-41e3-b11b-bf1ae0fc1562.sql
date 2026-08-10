CREATE OR REPLACE FUNCTION public.fn_agendar_servico(p_agenda_servico_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  _aluno_id uuid;
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
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWRncWVkemVvc2ZwZWhwZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc3OTEsImV4cCI6MjA5MTY4Mzc5MX0.PhsDgfnvkBWhqNDTztFrj8AEVgQQE0fVV1qiheL_xxk';
BEGIN
  _aluno_id := public.fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_nao_encontrado');
  END IF;

  SELECT * INTO _tpl
  FROM public.agenda_servicos
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
     p_data, _tpl.profissional_id, _aluno_id, 'Agendado pelo app do aluno')
  RETURNING id INTO _novo_id;

  -- Marca exceção no horário fixo da grade para esta data (vaga deixa de aparecer livre)
  IF _tpl.tipo = 'fixo' THEN
    BEGIN
      INSERT INTO public.agenda_servicos_excecoes (agenda_id, data_excecao)
      VALUES (_tpl.id, p_data);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Disparo de WhatsApp ao profissional (fire-and-forget)
  BEGIN
    PERFORM net.http_post(
      url := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/whatsapp-disparo-agenda',
      body := jsonb_build_object('evento', 'agendamento_criado', 'agenda_id', _novo_id),
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', _anon,
        'Authorization','Bearer ' || _anon,
        'x-webhook-secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_secret' LIMIT 1), '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'id', _novo_id);
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM ILIKE '%sem créditos%' OR SQLERRM ILIKE '%plano ativo%' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_creditos');
  END IF;
  RETURN jsonb_build_object('ok', false, 'erro', 'erro_interno', 'detalhe', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_agendamento_servico(p_agenda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  _aluno_id uuid;
  _reg record;
  _dentro_prazo boolean;
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWRncWVkemVvc2ZwZWhwZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc3OTEsImV4cCI6MjA5MTY4Mzc5MX0.PhsDgfnvkBWhqNDTztFrj8AEVgQQE0fVV1qiheL_xxk';
BEGIN
  _aluno_id := public.fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_nao_encontrado');
  END IF;

  SELECT * INTO _reg FROM public.agenda_servicos WHERE id = p_agenda_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'agendamento_nao_encontrado');
  END IF;

  IF _reg.aluno_id IS DISTINCT FROM _aluno_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;

  IF _reg.data_especifica IS NULL OR _reg.data_especifica < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'data_passada');
  END IF;

  _dentro_prazo := ((_reg.data_especifica + COALESCE(_reg.horario_inicio, '00:00'::time))
                    - (now() AT TIME ZONE 'America/Sao_Paulo')) >= interval '8 hours';

  BEGIN
    PERFORM net.http_post(
      url := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/whatsapp-disparo-agenda',
      body := jsonb_build_object(
        'evento', 'agendamento_cancelado',
        'agenda_id', p_agenda_id,
        'agenda_snapshot', jsonb_build_object(
          'atividade', _reg.atividade,
          'profissional_id', _reg.profissional_id,
          'consultor_id', _reg.consultor_id,
          'aluno_id', _reg.aluno_id,
          'data_especifica', _reg.data_especifica,
          'dia_semana', _reg.dia_semana,
          'horario_inicio', _reg.horario_inicio,
          'horario_fim', _reg.horario_fim,
          'local', _reg.local,
          'tipo', _reg.tipo,
          'protocolo', _reg.protocolo,
          'observacoes', _reg.observacoes
        )
      ),
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', _anon,
        'Authorization','Bearer ' || _anon,
        'x-webhook-secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_secret' LIMIT 1), '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF NOT _dentro_prazo THEN
    PERFORM set_config('app.bloquear_estorno_agenda', 'true', true);
  END IF;

  DELETE FROM public.agenda_servicos WHERE id = p_agenda_id;

  PERFORM set_config('app.bloquear_estorno_agenda', 'false', true);

  -- Libera novamente a vaga fixa da grade nesta data
  DELETE FROM public.agenda_servicos_excecoes e
  USING public.agenda_servicos t
  WHERE e.agenda_id = t.id
    AND e.data_excecao = _reg.data_especifica
    AND t.tipo = 'fixo'
    AND t.aluno_id IS NULL
    AND t.profissional_id IS NOT DISTINCT FROM _reg.profissional_id
    AND t.horario_inicio = _reg.horario_inicio
    AND t.atividade = _reg.atividade;

  RETURN jsonb_build_object(
    'ok', true,
    'credito_estornado', _dentro_prazo,
    'mensagem', CASE WHEN _dentro_prazo
      THEN 'Agendamento cancelado e crédito estornado.'
      ELSE 'Agendamento cancelado. Como faltavam menos de 8h, o crédito não foi estornado.'
    END
  );
END;
$function$;