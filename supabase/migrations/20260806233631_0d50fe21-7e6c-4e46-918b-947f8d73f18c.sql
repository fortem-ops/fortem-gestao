-- Alunos podem ver horários "modelo" abertos e visíveis no portal
DROP POLICY IF EXISTS "Alunos veem horarios abertos do portal" ON public.agenda_servicos;
CREATE POLICY "Alunos veem horarios abertos do portal"
ON public.agenda_servicos
FOR SELECT
TO authenticated
USING (visivel_portal = true AND aluno_id IS NULL);

CREATE OR REPLACE FUNCTION public.fn_agendar_servico(p_agenda_servico_id uuid, p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Créditos do plano (mesmo mapeamento do gatilho de débito)
  _plan_label := CASE _tpl.atividade
    WHEN 'Avaliação Funcional' THEN 'Avaliação Funcional'
    WHEN 'Nutrição'            THEN 'Consultas Nutrição'
    WHEN 'Reabilitação'        THEN 'Consultas Reabilitação'
    ELSE NULL
  END;

  IF _plan_label IS NOT NULL THEN
    SELECT * INTO _plano
    FROM public.planos
    WHERE aluno_id = _aluno_id AND ativo = true
    ORDER BY created_at DESC
    LIMIT 1;

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

  -- Créditos avulsos / lançados em creditos_aluno
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

  -- O gatilho trg_agenda_debitar_credito realiza o débito priorizando
  -- o plano e, na ausência de saldo, os créditos avulsos.
  INSERT INTO public.agenda_servicos
    (atividade, local, dia_semana, horario_inicio, horario_fim, tipo,
     data_especifica, profissional_id, aluno_id, observacoes)
  VALUES
    (_tpl.atividade, _tpl.local, EXTRACT(DOW FROM p_data)::int,
     _tpl.horario_inicio, _tpl.horario_fim, _tpl.tipo,
     p_data, _tpl.profissional_id, _aluno_id, 'Agendado pelo app do aluno')
  RETURNING id INTO _novo_id;

  RETURN jsonb_build_object('ok', true, 'id', _novo_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', 'sem_creditos');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, date) TO authenticated;