-- 1. Coluna de vínculo entre treino_agendamentos e agenda_servicos (Treino Experimental de prospect)
ALTER TABLE public.treino_agendamentos
  ADD COLUMN IF NOT EXISTS agenda_servico_id uuid REFERENCES public.agenda_servicos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treino_agendamentos_agenda_servico_id
  ON public.treino_agendamentos(agenda_servico_id)
  WHERE agenda_servico_id IS NOT NULL;

-- 2. Gatilho: ao excluir Treino Experimental da Agenda de Serviços, cancela o treino vinculado
CREATE OR REPLACE FUNCTION public.fn_trg_agenda_servico_delete_cancelar_treino()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.treino_agendamentos
  SET status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = 'staff',
      observacoes = trim(both ' ' from coalesce(observacoes, '') || ' Treino Experimental cancelado na Agenda de Serviços.')
  WHERE agenda_servico_id = OLD.id
    AND status IN ('agendado', 'confirmado');
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_agenda_servico_delete_cancelar_treino ON public.agenda_servicos;
CREATE TRIGGER trg_agenda_servico_delete_cancelar_treino
  BEFORE DELETE ON public.agenda_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_agenda_servico_delete_cancelar_treino();

-- 3. Ao remover aluno pela equipe na Agenda de Treinos, remove também o Treino Experimental vinculado
CREATE OR REPLACE FUNCTION public.fn_staff_excluir_treino_agendamento(
  p_agendamento_id uuid,
  p_estornar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _ag public.treino_agendamentos%ROWTYPE;
  _reposto boolean := false;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT * INTO _ag FROM public.treino_agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  END IF;

  IF COALESCE(p_estornar, true) AND _ag.credito_debitado AND _ag.ciclo_id IS NOT NULL
     AND NOT COALESCE(_ag.credito_estornado, false) THEN
    UPDATE public.ciclos_credito
    SET creditos_usados = GREATEST(0, creditos_usados - 1)
    WHERE id = _ag.ciclo_id;
    _reposto := true;
  END IF;

  UPDATE public.treino_agendamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = 'staff',
    credito_estornado = COALESCE(_ag.credito_estornado, false) OR _reposto,
    observacoes = CASE WHEN _reposto
      THEN trim(both ' ' from coalesce(observacoes, '') || ' Reposição disponível — horário removido pela equipe.')
      ELSE observacoes END
  WHERE id = p_agendamento_id;

  IF _ag.agenda_servico_id IS NOT NULL THEN
    DELETE FROM public.agenda_servicos WHERE id = _ag.agenda_servico_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'credito_estornado', _reposto);
END;
$function$;

-- 4. Lista de alunos agendáveis pela equipe: ativos com plano/contrato vigente + prospects
CREATE OR REPLACE FUNCTION public.fn_alunos_agendaveis_equipe()
RETURNS TABLE(id uuid, nome text, status text, responsavel_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.id, a.nome, a.status, a.responsavel_id
  FROM public.alunos a
  WHERE NOT COALESCE(a.is_equipe, false)
    AND (
      a.status = 'prospect'
      OR (
        a.status = 'ativo'
        AND (
          EXISTS (
            SELECT 1
            FROM public.planos p
            WHERE p.aluno_id = a.id
              AND p.ativo = true
              AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE)
          )
          OR EXISTS (
            SELECT 1
            FROM public.contratos c
            WHERE c.aluno_id = a.id
              AND c.status = 'ativo'
              AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
          )
        )
      )
    )
  ORDER BY CASE WHEN a.status = 'ativo' THEN 0 ELSE 1 END, a.nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_alunos_agendaveis_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_alunos_agendaveis_equipe() TO authenticated, service_role;

-- 5. Saldo de créditos de treino: suporta prospect, agregadora, Livre, ciclos 2027 e planos legados
CREATE OR REPLACE FUNCTION public.fn_saldo_creditos_treino_aluno(p_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _aluno_status text;
  _plano public.planos%ROWTYPE;
  _contrato public.contratos%ROWTYPE;
  _eh_agregadora boolean := false;
  _eh_livre boolean := false;
  _tem_ciclo boolean := false;
  _total int := 0;
  _usados int := 0;
  _dias int;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'professor')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  IF p_aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_invalido');
  END IF;

  SELECT a.status INTO _aluno_status FROM public.alunos a WHERE a.id = p_aluno_id;
  IF _aluno_status = 'prospect' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'tipo', 'prospect',
      'saldo', NULL,
      'total', NULL,
      'usados', NULL,
      'plano_nome', 'Treino Experimental'
    );
  END IF;

  SELECT * INTO _plano FROM public.fn_plano_principal_ativo(p_aluno_id);

  IF lower(COALESCE(_plano.tipo, '')) IN ('gympass', 'wellhub', 'total pass', 'totalpass') THEN
    _eh_agregadora := true;
  ELSIF _plano.id IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.contratos c
      WHERE c.aluno_id = p_aluno_id
        AND c.status = 'ativo'
        AND c.plano_tipo IN ('gympass', 'wellhub', 'totalpass')
    ) INTO _eh_agregadora;
  END IF;

  IF _eh_agregadora THEN
    RETURN jsonb_build_object(
      'ok', true,
      'tipo', 'agregadora',
      'saldo', NULL,
      'total', NULL,
      'usados', NULL,
      'plano_nome', COALESCE(_plano.tipo, 'Agregadora')
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.contratos c
    WHERE c.aluno_id = p_aluno_id
      AND c.status = 'ativo'
      AND c.frequencia_semanal = 5
      AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
  ) INTO _eh_livre;

  IF _eh_livre THEN
    RETURN jsonb_build_object(
      'ok', true,
      'tipo', 'livre',
      'saldo', NULL,
      'total', NULL,
      'usados', NULL,
      'plano_nome', COALESCE(_plano.tipo, 'Livre')
    );
  END IF;

  SELECT
    COUNT(*) > 0,
    COALESCE(SUM(cc.creditos_liberados), 0)::int,
    COALESCE(SUM(cc.creditos_usados), 0)::int
  INTO _tem_ciclo, _total, _usados
  FROM public.ciclos_credito cc
  JOIN public.contratos c ON c.id = cc.contrato_id
  WHERE c.aluno_id = p_aluno_id
    AND cc.status = 'ativo'
    AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE);

  IF _tem_ciclo THEN
    RETURN jsonb_build_object(
      'ok', true,
      'tipo', 'creditos',
      'origem', 'ciclo',
      'saldo', (_total - _usados),
      'total', _total,
      'usados', _usados,
      'plano_nome', _plano.tipo
    );
  END IF;

  -- Fallback para planos legados (sem ciclos_credito): calcula pelo contrato vigente
  SELECT c.* INTO _contrato
  FROM public.contratos c
  WHERE c.aluno_id = p_aluno_id
    AND c.status = 'ativo'
    AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
    AND c.frequencia_semanal IS NOT NULL
    AND c.frequencia_semanal > 0
  ORDER BY (lower(COALESCE(c.plano_tipo, '')) NOT LIKE '%corrida%') DESC, c.data_inicio DESC
  LIMIT 1;

  IF FOUND THEN
    IF _contrato.data_fim IS NULL THEN
      _total := _contrato.frequencia_semanal * 52;
    ELSE
      _dias := GREATEST(1, (_contrato.data_fim - _contrato.data_inicio));
      IF _dias BETWEEN 350 AND 380 THEN
        _total := _contrato.frequencia_semanal * 52;
      ELSE
        _total := GREATEST(1, ROUND(_contrato.frequencia_semanal * (_dias::numeric / 7.0))::int);
      END IF;
    END IF;

    SELECT COUNT(*)::int INTO _usados
    FROM public.treino_agendamentos ta
    WHERE ta.aluno_id = p_aluno_id
      AND ta.status <> 'cancelado'
      AND ta.data >= _contrato.data_inicio
      AND (_contrato.data_fim IS NULL OR ta.data <= _contrato.data_fim);

    RETURN jsonb_build_object(
      'ok', true,
      'tipo', 'creditos',
      'origem', 'legado',
      'saldo', (_total - _usados),
      'total', _total,
      'usados', _usados,
      'plano_nome', COALESCE(_plano.tipo, _contrato.plano_tipo)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'tipo', 'creditos',
    'origem', 'nenhum',
    'saldo', 0,
    'total', 0,
    'usados', 0,
    'plano_nome', _plano.tipo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_saldo_creditos_treino_aluno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_saldo_creditos_treino_aluno(uuid) TO authenticated, service_role;

-- 6. Incluir aluno ou prospect no horário pela equipe (com vínculo obrigatório ao Treino Experimental para prospects)
DROP FUNCTION IF EXISTS public.fn_agendar_treino_equipe(uuid, date, uuid, boolean);

CREATE OR REPLACE FUNCTION public.fn_agendar_treino_equipe(
  p_slot_id uuid,
  p_data date,
  p_aluno_id uuid,
  p_ignorar_capacidade boolean DEFAULT true,
  p_agenda_servico_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _aluno_status text;
  _slot public.treino_slots%ROWTYPE;
  _exc public.treino_slot_excecoes%ROWTYPE;
  _plano public.planos%ROWTYPE;
  _ciclo public.ciclos_credito%ROWTYPE;
  _horario_inicio time without time zone;
  _horario_fim time without time zone;
  _capacidade smallint;
  _modalidade text;
  _vagas_ocupadas int;
  _agendamento_id uuid;
  _eh_agregadora boolean := false;
  _eh_livre boolean := false;
  _debitado boolean := false;
  _ciclo_id uuid := NULL;
  _creditos_restantes int := NULL;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT a.status INTO _aluno_status
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND a.status IN ('ativo', 'prospect')
    AND NOT COALESCE(a.is_equipe, false);

  IF _aluno_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_invalido');
  END IF;

  IF _aluno_status = 'prospect' THEN
    IF p_agenda_servico_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.agenda_servicos s
      WHERE s.id = p_agenda_servico_id
        AND s.aluno_id = p_aluno_id
        AND s.atividade = 'Treino Experimental'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'experimental_obrigatorio');
    END IF;
  END IF;

  SELECT * INTO _slot FROM public.treino_slots WHERE id = p_slot_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'slot_invalido');
  END IF;

  IF EXTRACT(DOW FROM p_data)::smallint != _slot.dia_semana THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'dia_invalido');
  END IF;

  SELECT * INTO _exc FROM public.treino_slot_excecoes WHERE slot_id = p_slot_id AND data = p_data;
  _horario_inicio := COALESCE(_exc.horario_inicio, _slot.horario_inicio);
  _horario_fim := COALESCE(_exc.horario_fim, _slot.horario_fim);
  _capacidade := COALESCE(_exc.capacidade_maxima, _slot.capacidade_maxima);
  _modalidade := COALESCE(_exc.modalidade, _slot.modalidade);

  PERFORM pg_advisory_xact_lock(hashtext(p_aluno_id::text || p_data::text));

  IF EXISTS (
    SELECT 1
    FROM public.treino_agendamentos a
    WHERE a.aluno_id = p_aluno_id
      AND a.slot_id = p_slot_id
      AND a.data = p_data
      AND a.status IN ('agendado', 'confirmado')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_agendado_neste_horario');
  END IF;

  SELECT COUNT(*) INTO _vagas_ocupadas
  FROM public.treino_agendamentos
  WHERE slot_id = p_slot_id
    AND data = p_data
    AND status IN ('agendado', 'confirmado');

  IF NOT COALESCE(p_ignorar_capacidade, true) AND _vagas_ocupadas >= _capacidade THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_vagas');
  END IF;

  IF _aluno_status = 'ativo' AND _modalidade <> 'corrida' THEN
    SELECT * INTO _plano FROM public.fn_plano_principal_ativo(p_aluno_id);

    IF lower(COALESCE(_plano.tipo, '')) IN ('gympass', 'wellhub', 'total pass', 'totalpass') THEN
      _eh_agregadora := true;
    ELSIF _plano.id IS NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.contratos c
        WHERE c.aluno_id = p_aluno_id
          AND c.status = 'ativo'
          AND c.plano_tipo IN ('gympass', 'wellhub', 'totalpass')
      ) INTO _eh_agregadora;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.contratos c
      WHERE c.aluno_id = p_aluno_id
        AND c.status = 'ativo'
        AND c.frequencia_semanal = 5
        AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
    ) INTO _eh_livre;

    IF NOT _eh_agregadora AND NOT _eh_livre THEN
      SELECT cc.* INTO _ciclo
      FROM public.ciclos_credito cc
      JOIN public.contratos c ON c.id = cc.contrato_id
      WHERE c.aluno_id = p_aluno_id
        AND cc.status = 'ativo'
        AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
      ORDER BY ((cc.creditos_liberados - cc.creditos_usados) > 0) DESC, cc.created_at DESC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.ciclos_credito
        SET creditos_usados = creditos_usados + 1
        WHERE id = _ciclo.id;

        _debitado := true;
        _ciclo_id := _ciclo.id;
        _creditos_restantes := (_ciclo.creditos_liberados - _ciclo.creditos_usados - 1);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.treino_agendamentos (
    aluno_id, slot_id, data, horario_inicio, horario_fim,
    status, ciclo_id, credito_debitado, created_by, agenda_servico_id
  ) VALUES (
    p_aluno_id, p_slot_id, p_data, _horario_inicio, _horario_fim,
    'agendado', _ciclo_id, _debitado, auth.uid(), p_agenda_servico_id
  ) RETURNING id INTO _agendamento_id;

  INSERT INTO public.audit_log (user_id, operacao, tabela, registro_id, dados_novos)
  VALUES (
    auth.uid(),
    'insert',
    'treino_agendamentos',
    _agendamento_id::text,
    jsonb_build_object(
      'origem', 'equipe_agenda_treinos',
      'aluno_id', p_aluno_id,
      'slot_id', p_slot_id,
      'data', p_data,
      'credito_debitado', _debitado,
      'acima_capacidade', (_vagas_ocupadas >= _capacidade),
      'agenda_servico_id', p_agenda_servico_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'agendamento_id', _agendamento_id,
    'credito_debitado', _debitado,
    'creditos_restantes', _creditos_restantes,
    'acima_capacidade', (_vagas_ocupadas >= _capacidade)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean, uuid) TO authenticated, service_role;