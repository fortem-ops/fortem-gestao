-- E5b ANTES (somente leitura, capturado em 2026-10-23)
-- owner: postgres | SECURITY DEFINER
-- fn_agendar_treino(uuid,date): search_path=public | EXECUTE: PUBLIC, anon, authenticated, service_role
-- fn_agendar_servico(uuid,date): search_path=public, extensions, vault | EXECUTE: PUBLIC, anon, authenticated, service_role
-- fn_agendar_servico(uuid,uuid,timestamptz,uuid,text): search_path=public | EXECUTE: PUBLIC, anon, authenticated, service_role (NÃO alterada pela proposta)

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

-- Referência (não muda):
CREATE OR REPLACE FUNCTION public.fn_agendar_servico(_aluno_id uuid, _servico_catalogo_id uuid, _data_hora timestamp with time zone, _profissional_id uuid DEFAULT NULL::uuid, _observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _plano public.planos%ROWTYPE;
  _servico public.servicos_catalogo%ROWTYPE;
  _credito public.creditos_aluno%ROWTYPE;
  _agenda public.agenda_servicos%ROWTYPE;
  _consumo public.consumo_servicos%ROWTYPE;
  _saldo integer;
  _servicos_incluidos jsonb;
  _qtd_incluida integer;
  _fim timestamp with time zone;
BEGIN
  -- Busca o plano ativo de treinamento funcional do aluno
  SELECT * INTO _plano
  FROM public.planos
  WHERE aluno_id = _aluno_id
    AND ativo = true
    AND atividade = 'treinamento_funcional'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Busca o serviço do catálogo
  SELECT * INTO _servico
  FROM public.servicos_catalogo
  WHERE id = _servico_catalogo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'servico_nao_encontrado');
  END IF;

  -- Calcula fim com base na duração padrão do serviço
  _fim := _data_hora + COALESCE(_servico.duracao_minutos, 60) * interval '1 minute';

  -- Verifica crédito no plano
  IF FOUND THEN
    _servicos_incluidos := COALESCE(_plano.servicos_incluidos, '[]'::jsonb);

    SELECT (elem->>'quantidade')::int
    INTO _qtd_incluida
    FROM jsonb_array_elements(_servicos_incluidos) AS elem
    WHERE (elem->>'servico_catalogo_id')::uuid = _servico_catalogo_id;

    IF _qtd_incluida IS NOT NULL AND _qtd_incluida > 0 THEN
      -- Verifica saldo real de créditos desse serviço
      SELECT * INTO _credito
      FROM public.creditos_aluno
      WHERE aluno_id = _aluno_id
        AND servico_catalogo_id = _servico_catalogo_id
        AND plano_id = _plano.id
        AND status = 'ativo'
      ORDER BY created_at DESC
      LIMIT 1;

      IF FOUND THEN
        _saldo := COALESCE(_credito.saldo, 0);
      ELSE
        -- Cria o crédito com a quantidade incluída no plano
        INSERT INTO public.creditos_aluno (
          aluno_id,
          plano_id,
          servico_catalogo_id,
          saldo,
          status
        ) VALUES (
          _aluno_id,
          _plano.id,
          _servico_catalogo_id,
          _qtd_incluida,
          'ativo'
        )
        RETURNING * INTO _credito;

        _saldo := _qtd_incluida;
      END IF;

      IF _saldo <= 0 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'sem_creditos', 'detalhe', 'Créditos do plano esgotados para este serviço');
      END IF;
    ELSE
      RETURN jsonb_build_object('sucesso', false, 'erro', 'sem_creditos', 'detalhe', 'Plano ativo não inclui este serviço');
    END IF;
  ELSE
    RETURN jsonb_build_object('sucesso', false, 'erro', 'sem_creditos', 'detalhe', 'Nenhum plano ativo de treinamento funcional encontrado');
  END IF;

  -- Cria o agendamento
  INSERT INTO public.agenda_servicos (
    aluno_id,
    servico_catalogo_id,
    profissional_id,
    data_hora,
    fim,
    observacoes,
    status,
    origem
  ) VALUES (
    _aluno_id,
    _servico_catalogo_id,
    _profissional_id,
    _data_hora,
    _fim,
    _observacoes,
    'agendado',
    'portal'
  )
  RETURNING * INTO _agenda;

  -- Consome o crédito
  UPDATE public.creditos_aluno
  SET saldo = saldo - 1,
      updated_at = now()
  WHERE id = _credito.id
  RETURNING * INTO _credito;

  -- Registra o consumo
  INSERT INTO public.consumo_servicos (
    aluno_id,
    plano_id,
    servico_catalogo_id,
    agenda_servico_id,
    quantidade
  ) VALUES (
    _aluno_id,
    _plano.id,
    _servico_catalogo_id,
    _agenda.id,
    1
  )
  RETURNING * INTO _consumo;

  RETURN jsonb_build_object(
    'sucesso', true,
    'agenda_id', _agenda.id,
    'credito_id', _credito.id,
    'saldo_restante', _credito.saldo
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'erro_interno', 'detalhe', SQLERRM);
END;
$function$;

-- Policies atuais em treino_agendamentos:
-- aluno_own_treino_agendamentos  FOR ALL TO public USING/WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
-- staff_all_treino_agendamentos  FOR ALL TO public USING/WITH CHECK (is_staff())
