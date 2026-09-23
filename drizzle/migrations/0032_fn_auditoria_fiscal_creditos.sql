CREATE OR REPLACE FUNCTION public.fn_auditoria_fiscal_creditos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_formula int := 0;
  v_usado int := 0;
  v_negativo int := 0;
  v_sem_agenda int := 0;
BEGIN
  -- 1a. Quantidade inicial do crédito de Treino difere do total de créditos do contrato vigente.
  WITH ref AS (
    SELECT c.id AS credito_id, c.aluno_id, c.quantidade_inicial, a.nome,
           ct.id AS contrato_id, ct.creditos_total, ct.frequencia_semanal
    FROM public.creditos_aluno c
    JOIN public.alunos a ON a.id = c.aluno_id
    JOIN LATERAL (
      SELECT ct.* FROM public.contratos ct
      WHERE ct.aluno_id = c.aluno_id
        AND ct.status NOT IN ('cancelado', 'encerrado')
        AND coalesce(ct.creditos_total, 0) > 0
        AND (ct.data_fim IS NULL OR ct.data_fim >= current_date)
      ORDER BY ct.data_inicio DESC NULLS LAST, ct.created_at DESC
      LIMIT 1
    ) ct ON true
    WHERE c.ativo = true
      AND c.atividade = 'Treino'
      AND c.origem_tipo = 'plano'
      AND coalesce(c.ilimitado, false) = false
      AND (c.data_validade IS NULL OR c.data_validade >= current_date)
  ), novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'creditos',
      'saldo_divergente_formula',
      'atencao',
      'Crédito de Treino de ' || r.nome || ' foi lançado com ' || r.quantidade_inicial ||
        ' crédito(s), mas o contrato vigente prevê ' || r.creditos_total ||
        ' (frequência ' || coalesce(r.frequencia_semanal::text, '?') || 'x por semana).',
      r.aluno_id,
      jsonb_build_object('credito_id', r.credito_id, 'contrato_id', r.contrato_id, 'aluno_id', r.aluno_id)
    FROM ref r
    WHERE r.quantidade_inicial IS DISTINCT FROM r.creditos_total
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_formula FROM novos;

  -- 1b. Quantidade usada difere da soma real dos movimentos.
  WITH calc AS (
    SELECT c.id AS credito_id, c.aluno_id, c.atividade, a.nome,
           coalesce(c.quantidade_usada, 0) AS usado_registrado,
           coalesce(sum(CASE WHEN m.tipo = 'consumo' THEN m.quantidade
                             WHEN m.tipo = 'estorno' THEN -m.quantidade
                             ELSE 0 END), 0)::int AS usado_calculado
    FROM public.creditos_aluno c
    JOIN public.alunos a ON a.id = c.aluno_id
    LEFT JOIN public.creditos_movimentos m ON m.credito_id = c.id
    WHERE c.ativo = true
    GROUP BY c.id, c.aluno_id, c.atividade, a.nome, c.quantidade_usada
  ), novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'creditos',
      'usado_divergente_movimentos',
      'atencao',
      'Crédito de ' || k.atividade || ' de ' || k.nome || ' registra ' || k.usado_registrado ||
        ' uso(s), mas o histórico de movimentos soma ' || k.usado_calculado || '.',
      k.aluno_id,
      jsonb_build_object('credito_id', k.credito_id, 'aluno_id', k.aluno_id)
    FROM calc k
    WHERE k.usado_registrado <> k.usado_calculado
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_usado FROM novos;

  -- 2. Saldo negativo.
  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'creditos',
      'saldo_negativo',
      'critico',
      'Crédito de ' || c.atividade || ' de ' || a.nome || ' está com saldo negativo: ' ||
        (coalesce(c.quantidade_inicial, 0) - coalesce(c.quantidade_usada, 0)) ||
        ' (inicial ' || coalesce(c.quantidade_inicial, 0) || ', usado ' || coalesce(c.quantidade_usada, 0) || ').',
      c.aluno_id,
      jsonb_build_object('credito_id', c.id, 'aluno_id', c.aluno_id)
    FROM public.creditos_aluno c
    JOIN public.alunos a ON a.id = c.aluno_id
    WHERE c.ativo = true
      AND coalesce(c.ilimitado, false) = false
      AND coalesce(c.quantidade_inicial, 0) - coalesce(c.quantidade_usada, 0) < 0
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_negativo FROM novos;

  -- 3. Consumo sem agendamento correspondente.
  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'creditos',
      'consumo_sem_agendamento',
      'atencao',
      'Consumo de crédito de ' || c.atividade || ' de ' || a.nome || ' em ' ||
        to_char(m.data, 'DD/MM/YYYY') || ' não está vinculado a nenhum agendamento existente.',
      c.aluno_id,
      jsonb_build_object('movimento_id', m.id, 'credito_id', c.id, 'aluno_id', c.aluno_id)
    FROM public.creditos_movimentos m
    JOIN public.creditos_aluno c ON c.id = m.credito_id
    JOIN public.alunos a ON a.id = c.aluno_id
    WHERE m.tipo = 'consumo'
      AND m.data >= now() - interval '12 months'
      AND (
        (m.agenda_id IS NULL AND m.consumo_id IS NULL)
        OR (
          m.agenda_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.agenda_servicos s WHERE s.id = m.agenda_id)
          AND NOT EXISTS (SELECT 1 FROM public.treino_agendamentos t WHERE t.id = m.agenda_id)
        )
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_sem_agenda FROM novos;

  RETURN jsonb_build_object(
    'saldo_divergente_formula', v_formula,
    'usado_divergente_movimentos', v_usado,
    'saldo_negativo', v_negativo,
    'consumo_sem_agendamento', v_sem_agenda,
    'executado_em', now()
  );
END;
$function$;