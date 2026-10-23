-- E5b-A ENSAIO (transação desfeita: termina sempre em RAISE EXCEPTION; nada fica gravado)
-- Fases antes/depois; cada cenário roda num sub-bloco desfeito. Impressão digital sem ids/timestamps/referências.
DO $ens$
DECLARE
  aluno constant uuid := '085acf57-2dbe-464d-9acc-e1b0f5b77032';
  staff constant uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  fake_uid uuid := gen_random_uuid();
  slot constant uuid := 'ce3a980f-9b45-4da6-bb41-527991f063a9';   -- treino, segunda 06:00
  tpl  constant uuid := '3569cf5c-5308-475d-bbac-e46d26c10c05';   -- Reabilitação fixo, segunda 16:30
  dia  constant date := '2026-10-26';
  cats jsonb := jsonb_build_object('start','c7292e78-e758-4088-a073-059e15f2910d','power','42e1e025-906e-472f-8f88-d45a18fc8bd8',
                                   'pro','559ce8ff-43fa-4768-bfca-0ad6e376bc6d','consultoria','c958faf4-f3ba-4b8f-960a-019b4c31aa38');
  cens text[] := ARRAY['start','power','pro','sem_plano','consultoria','consultoria+start','equipe_consultoria'];
  fase text; cen text; f text; res text; r1 jsonb; r2 jsonb; k uuid; antes text; depois text;
  out jsonb := '{}'; meta_a text; meta_d text; prop text;
BEGIN
  prop := $prop$
CREATE OR REPLACE FUNCTION public.fn_agendar_treino(p_slot_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_id uuid;
  _slot treino_slots%ROWTYPE;
  _vagas_ocupadas int;
  _ciclo ciclos_credito%ROWTYPE;
  _agendamento_id uuid;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  -- E5b: aluno só com Consultoria Online não agenda pelo app (equipe usa fn_agendar_servico_equipe)
  IF public.fn_aluno_somente_online(_aluno_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'somente_online');
  END IF;

  SELECT * INTO _slot FROM treino_slots WHERE id = p_slot_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'slot_invalido');
  END IF;

  IF EXTRACT(DOW FROM p_data)::smallint != _slot.dia_semana THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'dia_invalido');
  END IF;

  IF p_data < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'data_passada');
  END IF;

  IF p_data = CURRENT_DATE
     AND ((p_data + _slot.horario_inicio) AT TIME ZONE 'America/Sao_Paulo') <= now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_passado');
  END IF;

  -- Lock por aluno+dia para evitar corrida entre requisições simultâneas
  PERFORM pg_advisory_xact_lock(hashtext(_aluno_id::text || p_data::text));

  -- Aluno: no máximo 1 agendamento ativo por dia, de QUALQUER modalidade
  IF EXISTS (
    SELECT 1
    FROM treino_agendamentos a
    WHERE a.aluno_id = _aluno_id
      AND a.data = p_data
      AND a.status IN ('agendado', 'confirmado')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_agendado_neste_dia');
  END IF;

  SELECT COUNT(*) INTO _vagas_ocupadas
  FROM treino_agendamentos
  WHERE slot_id = p_slot_id AND data = p_data
  AND status IN ('agendado', 'confirmado');

  IF _vagas_ocupadas >= _slot.capacidade_maxima THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_vagas');
  END IF;

  -- Corrida: sem controle de créditos, exige contrato de corrida ativo
  IF _slot.modalidade = 'corrida' THEN
    IF NOT EXISTS (
      SELECT 1 FROM contratos c
      WHERE c.aluno_id = _aluno_id
        AND c.status = 'ativo'
        AND c.plano_tipo = 'corrida'
        AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'sem_plano_corrida');
    END IF;

    INSERT INTO treino_agendamentos (
      aluno_id, slot_id, data, horario_inicio, horario_fim,
      status, ciclo_id, credito_debitado, created_by
    ) VALUES (
      _aluno_id, p_slot_id, p_data, _slot.horario_inicio, _slot.horario_fim,
      'agendado', NULL, false, auth.uid()
    ) RETURNING id INTO _agendamento_id;

    RETURN jsonb_build_object('ok', true, 'agendamento_id', _agendamento_id);
  END IF;

  SELECT cc.* INTO _ciclo
  FROM ciclos_credito cc
  JOIN contratos c ON c.id = cc.contrato_id
  WHERE c.aluno_id = _aluno_id
  AND cc.status = 'ativo'
  AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
  AND (cc.creditos_liberados - cc.creditos_usados) > 0
  ORDER BY cc.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_creditos');
  END IF;

  UPDATE ciclos_credito
  SET creditos_usados = creditos_usados + 1
  WHERE id = _ciclo.id;

  INSERT INTO treino_agendamentos (
    aluno_id, slot_id, data, horario_inicio, horario_fim,
    status, ciclo_id, credito_debitado, created_by
  ) VALUES (
    _aluno_id, p_slot_id, p_data, _slot.horario_inicio, _slot.horario_fim,
    'agendado', _ciclo.id, true, auth.uid()
  ) RETURNING id INTO _agendamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'agendamento_id', _agendamento_id,
    'creditos_restantes', (_ciclo.creditos_liberados - _ciclo.creditos_usados - 1)
  );
END;
$function$;

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

  -- E5b: aluno só com Consultoria Online não agenda pelo app (equipe usa fn_agendar_servico_equipe)
  IF public.fn_aluno_somente_online(_aluno_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'somente_online');
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

REVOKE ALL ON FUNCTION public.fn_agendar_treino(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_agendar_treino(uuid, date) TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_agendar_servico(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, date) TO PUBLIC, anon, authenticated, service_role;

$prop$;
  SELECT string_agg(p.oid::regprocedure||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||p.proconfig::text||'|'||p.proacl::text||'|'||pg_get_function_result(p.oid), ' ; ' ORDER BY 1)
    INTO meta_a FROM pg_proc p WHERE p.oid IN ('fn_agendar_treino(uuid,date)'::regprocedure,'fn_agendar_servico(uuid,date)'::regprocedure);
  FOREACH fase IN ARRAY ARRAY['antes','depois'] LOOP
    IF fase = 'depois' THEN EXECUTE prop; END IF;
    FOREACH cen IN ARRAY cens LOOP
      res := NULL;
      BEGIN
        UPDATE alunos SET user_id = fake_uid WHERE id = aluno;
        UPDATE planos SET ativo = false WHERE aluno_id = aluno AND ativo;
        UPDATE creditos_aluno SET ativo = false WHERE aluno_id = aluno AND ativo;
        FOREACH f IN ARRAY (CASE cen WHEN 'sem_plano' THEN ARRAY[]::text[] WHEN 'consultoria+start' THEN ARRAY['consultoria','start']
                                 WHEN 'equipe_consultoria' THEN ARRAY['consultoria'] ELSE ARRAY[cen] END) LOOP
          INSERT INTO planos (aluno_id, catalogo_id, tipo, atividade, ativo, data_inicio, data_fim)
          SELECT aluno, c.id, c.nome, c.atividade, true, current_date, current_date + 30 FROM planos_catalogo c WHERE c.id = (cats->>f)::uuid;
        END LOOP;
        -- créditos idênticos em todos os cenários (para a recusa não vir de falta de crédito)
        UPDATE ciclos_credito cc SET status = 'expirado' FROM contratos c WHERE c.id = cc.contrato_id AND c.aluno_id = aluno AND cc.status = 'ativo';
        UPDATE creditos_aluno SET ativo = false WHERE aluno_id = aluno AND ativo;
        INSERT INTO contratos (aluno_id, plano_tipo, vigencia_tipo, data_inicio, data_fim, forma_pagamento, valor_base, valor_cobrado, status)
        VALUES (aluno, 'outro', 'mensal', current_date, current_date + 30, 'pix', 0, 0, 'ativo') RETURNING id INTO k;
        DELETE FROM ciclos_credito WHERE contrato_id = k;
        INSERT INTO ciclos_credito (contrato_id, creditos_liberados, creditos_usados, data_inicio, data_fim, status)
        VALUES (k, 5, 0, current_date, current_date + 30, 'ativo');
        INSERT INTO creditos_aluno (aluno_id, origem_tipo, atividade, quantidade_inicial, quantidade_usada, ativo, data_validade)
        VALUES (aluno, 'plano', 'Reabilitação', 2, 0, true, current_date + 30);
        antes := (SELECT concat_ws('/', (SELECT count(*) FROM treino_agendamentos WHERE aluno_id=aluno), (SELECT count(*) FROM agenda_servicos WHERE aluno_id=aluno),
                  (SELECT count(*) FROM consumo_servicos WHERE aluno_id=aluno), (SELECT sum(creditos_usados) FROM ciclos_credito WHERE contrato_id=k),
                  (SELECT sum(quantidade_usada) FROM creditos_aluno WHERE aluno_id=aluno AND ativo), (SELECT count(*) FROM agenda_servicos_excecoes WHERE agenda_id=tpl)));
        IF cen = 'equipe_consultoria' THEN
          PERFORM set_config('request.jwt.claims', json_build_object('sub',staff,'role','authenticated')::text, true);
          r1 := NULL;
          r2 := public.fn_agendar_servico_equipe(p_aluno_id => aluno, p_agenda_servico_id => tpl, p_data => dia);
        ELSE
          PERFORM set_config('request.jwt.claims', json_build_object('sub',fake_uid,'role','authenticated')::text, true);
          r1 := public.fn_agendar_treino(slot, dia);
          r2 := public.fn_agendar_servico(tpl, dia);
        END IF;
        PERFORM set_config('request.jwt.claims', '', true);
        depois := (SELECT concat_ws('/', (SELECT count(*) FROM treino_agendamentos WHERE aluno_id=aluno), (SELECT count(*) FROM agenda_servicos WHERE aluno_id=aluno),
                  (SELECT count(*) FROM consumo_servicos WHERE aluno_id=aluno), (SELECT sum(creditos_usados) FROM ciclos_credito WHERE contrato_id=k),
                  (SELECT sum(quantidade_usada) FROM creditos_aluno WHERE aluno_id=aluno AND ativo), (SELECT count(*) FROM agenda_servicos_excecoes WHERE agenda_id=tpl)));
        res := concat_ws(' # ', coalesce((r1 - 'agendamento_id' - 'id')::text,'-'), coalesce((r2 - 'agendamento_id' - 'id')::text,'-'), antes||'->'||depois,
          md5(coalesce((SELECT string_agg(concat_ws(',',slot_id,data,horario_inicio,horario_fim,status,credito_debitado,observacoes),';' ORDER BY slot_id)
                 FROM treino_agendamentos WHERE aluno_id=aluno AND created_at >= now()),'')
            || coalesce((SELECT string_agg(concat_ws(',',atividade,local,dia_semana,horario_inicio,horario_fim,tipo,data_especifica,profissional_id,observacoes),';')
                 FROM agenda_servicos WHERE aluno_id=aluno AND created_at >= now()),'')));
        RAISE EXCEPTION 'E5B_DESFAZ';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'E5B_DESFAZ' THEN res := 'ERRO: '||SQLERRM; END IF;
      END;
      out := out || jsonb_build_object(fase||':'||cen, res);
    END LOOP;
  END LOOP;
  SELECT string_agg(p.oid::regprocedure||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||p.proconfig::text||'|'||p.proacl::text||'|'||pg_get_function_result(p.oid), ' ; ' ORDER BY 1)
    INTO meta_d FROM pg_proc p WHERE p.oid IN ('fn_agendar_treino(uuid,date)'::regprocedure,'fn_agendar_servico(uuid,date)'::regprocedure);
  out := out || jsonb_build_object('meta_identica', meta_a = meta_d, 'meta', meta_d,
    'guard_presente', (SELECT bool_and(prosrc LIKE '%somente_online%') FROM pg_proc WHERE oid IN ('fn_agendar_treino(uuid,date)'::regprocedure,'fn_agendar_servico(uuid,date)'::regprocedure)));
  RAISE EXCEPTION 'E5B_RESULTADO %', out;
END $ens$;
