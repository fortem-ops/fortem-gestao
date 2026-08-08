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