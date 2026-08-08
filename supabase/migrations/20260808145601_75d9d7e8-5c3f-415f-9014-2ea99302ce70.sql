CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_credito()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _mov record;
  _credito record;
BEGIN
  IF current_setting('app.bloquear_estorno_agenda', true) = 'true' THEN
    RETURN OLD;
  END IF;

  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = OLD.id AND tipo = 'consumo'
  LOOP
    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito.id IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
    VALUES (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(),
            'Estorno por exclusão de agendamento');
  END LOOP;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_consumo_plano()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bloquear_estorno_agenda', true) = 'true' THEN
    RETURN OLD;
  END IF;

  DELETE FROM public.consumo_servicos
  WHERE agenda_id = OLD.id;
  RETURN OLD;
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

  -- Disparo de WhatsApp ANTES do DELETE (a edge function lê agenda_servicos pelo id)
  BEGIN
    PERFORM extensions.http_post(
      url := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/whatsapp-disparo-agenda',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', _anon,
        'Authorization','Bearer ' || _anon,
        'x-webhook-secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_secret' LIMIT 1), '')
      ),
      body := jsonb_build_object('evento', 'agendamento_cancelado', 'agenda_id', p_agenda_id)
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