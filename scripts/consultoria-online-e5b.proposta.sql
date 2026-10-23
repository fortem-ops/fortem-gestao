-- E5b PROPOSTA (A) — NÃO APLICADA
BEGIN;
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
COMMIT;

-- ===== PROPOSTA SEPARADA (B) — NÃO faz parte de (A); exige aprovação própria =====
-- O aluno pode INSERIR direto em treino_agendamentos pela policy FOR ALL.
-- A policy cobre também UPDATE usado pelo app (confirmar/realizado) e não pode ser endurecida inteira.
-- Equivalente: separar o INSERT do aluno com a mesma condição da RPC.
-- BEGIN;
-- DROP POLICY aluno_own_treino_agendamentos ON public.treino_agendamentos;
-- CREATE POLICY aluno_own_treino_agendamentos_sel ON public.treino_agendamentos FOR SELECT TO public
--   USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
-- CREATE POLICY aluno_own_treino_agendamentos_ins ON public.treino_agendamentos FOR INSERT TO public
--   WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL) AND NOT public.fn_aluno_somente_online(aluno_id));
-- CREATE POLICY aluno_own_treino_agendamentos_upd ON public.treino_agendamentos FOR UPDATE TO public
--   USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
--   WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
-- CREATE POLICY aluno_own_treino_agendamentos_del ON public.treino_agendamentos FOR DELETE TO public
--   USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
-- COMMIT;
-- agenda_servicos: INSERT exige profissional_id = auth.uid() ou coord/admin -> aluno não insere direto. Nada a propor.
--
-- ===== PROPOSTA SEPARADA (C) — achado de segurança, aprovação própria =====
-- fn_agendar_servico(uuid,uuid,timestamptz,uuid,text) não verifica quem chama, aceita qualquer _aluno_id,
-- grava agenda/consumo/crédito e é executável por anon/authenticated. Nenhum código do app nem edge a chama.
-- Sugestão: REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; (manter service_role).
