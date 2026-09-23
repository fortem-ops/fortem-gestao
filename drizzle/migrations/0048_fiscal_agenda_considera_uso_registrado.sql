CREATE OR REPLACE FUNCTION public.fn_auditoria_fiscal_agenda_servicos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_nutri int := 0; v_fisio int := 0; v_prof int := 0; v_sala int := 0;
BEGIN
  WITH alvo AS (
    SELECT pl.id AS plano_id, pl.aluno_id, pl.tipo, pl.data_inicio, pl.data_fim, s.servico, s.atividade, s.padrao
    FROM public.planos pl
    CROSS JOIN LATERAL (VALUES ('nutricao','Nutrição','%nutri%'),('fisioterapia','Reabilitação','%reabilit%')) s(servico, atividade, padrao)
    WHERE pl.ativo AND pl.aluno_id IS NOT NULL
      AND pl.data_inicio IS NOT NULL AND pl.data_inicio < current_date - 30
      AND EXISTS (SELECT 1 FROM unnest(coalesce(pl.servicos,'{}')) x WHERE x ILIKE s.padrao)
  ), faltando AS (
    SELECT a.* FROM alvo a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.agenda_servicos ag
      WHERE ag.aluno_id = a.aluno_id AND ag.atividade = a.atividade
        AND ((ag.tipo = 'avulso' AND ag.data_especifica BETWEEN a.data_inicio AND coalesce(a.data_fim, 'infinity'::date))
          OR (ag.tipo = 'fixo' AND ag.created_at::date <= coalesce(a.data_fim, 'infinity'::date)))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.consumo_servicos cs
      WHERE cs.aluno_id = a.aluno_id AND cs.tipo_servico ILIKE a.padrao
        AND cs.data_consumo BETWEEN a.data_inicio AND coalesce(a.data_fim, 'infinity'::date)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.creditos_movimentos m JOIN public.creditos_aluno c ON c.id = m.credito_id
      WHERE c.aluno_id = a.aluno_id AND c.atividade = a.atividade
        AND (m.tipo = 'consumo' OR (m.tipo = 'ajuste' AND m.observacao ILIKE '%usado % -> %'))
        AND m.data::date BETWEEN a.data_inicio AND coalesce(a.data_fim, 'infinity'::date)
    )
  ), novos AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'agenda_servicos',
      CASE f.servico WHEN 'nutricao' THEN 'plano_sem_nutricao' ELSE 'plano_sem_fisioterapia' END,
      'atencao',
      'Plano ' || coalesce(f.tipo,'') || ' (início ' || to_char(f.data_inicio,'DD/MM/YYYY') || ') inclui ' ||
        CASE f.servico WHEN 'nutricao' THEN 'Nutrição' ELSE 'Fisioterapia/Reabilitação' END ||
        ', mas não há agendamento nem uso registrado desse serviço na vigência.',
      f.aluno_id,
      jsonb_build_object('plano_id', f.plano_id, 'aluno_id', f.aluno_id, 'servico', f.servico)
    FROM faltando f
    ON CONFLICT DO NOTHING RETURNING subtipo
  )
  SELECT count(*) FILTER (WHERE subtipo='plano_sem_nutricao'), count(*) FILTER (WHERE subtipo='plano_sem_fisioterapia')
    INTO v_nutri, v_fisio FROM novos;

  WITH ag AS (
    SELECT * FROM public.agenda_servicos
    WHERE aluno_id IS NOT NULL AND horario_inicio IS NOT NULL AND horario_fim IS NOT NULL
      AND (tipo = 'fixo' OR (tipo = 'avulso' AND data_especifica BETWEEN current_date AND current_date + 30))
  ), pares AS (
    SELECT a.id AS id_a, b.id AS id_b, a.profissional_id AS prof_a, b.profissional_id AS prof_b,
      a.local AS local_a, b.local AS local_b,
      a.horario_inicio AS ini_a, a.horario_fim AS fim_a, b.horario_inicio AS ini_b, b.horario_fim AS fim_b,
      a.aluno_id,
      CASE WHEN a.tipo='fixo' AND b.tipo='fixo' THEN NULL ELSE coalesce(a.data_especifica, b.data_especifica) END AS data,
      coalesce(a.dia_semana, EXTRACT(dow FROM a.data_especifica)::int) AS dia
    FROM ag a JOIN ag b ON a.id < b.id
    WHERE a.horario_inicio < b.horario_fim AND b.horario_inicio < a.horario_fim
      AND ((a.profissional_id IS NOT NULL AND a.profissional_id = b.profissional_id)
        OR (nullif(trim(a.local),'') IS NOT NULL AND lower(trim(a.local)) = lower(trim(b.local))))
      AND (
        (a.tipo='avulso' AND b.tipo='avulso' AND a.data_especifica = b.data_especifica)
        OR (a.tipo='fixo' AND b.tipo='fixo' AND a.dia_semana = b.dia_semana)
        OR (a.tipo='fixo' AND b.tipo='avulso' AND a.dia_semana = EXTRACT(dow FROM b.data_especifica)::int
            AND a.created_at::date <= b.data_especifica
            AND NOT EXISTS (SELECT 1 FROM public.agenda_servicos_excecoes e WHERE e.agenda_id=a.id AND e.data_excecao=b.data_especifica))
        OR (a.tipo='avulso' AND b.tipo='fixo' AND b.dia_semana = EXTRACT(dow FROM a.data_especifica)::int
            AND b.created_at::date <= a.data_especifica
            AND NOT EXISTS (SELECT 1 FROM public.agenda_servicos_excecoes e WHERE e.agenda_id=b.id AND e.data_excecao=a.data_especifica))
      )
  ), novos AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'agenda_servicos',
      CASE WHEN p.prof_a = p.prof_b THEN 'conflito_profissional' ELSE 'conflito_sala' END,
      CASE WHEN p.prof_a = p.prof_b THEN 'critico' ELSE 'atencao' END,
      CASE WHEN p.prof_a = p.prof_b THEN 'Mesmo profissional com dois atendimentos sobrepostos ('
           ELSE 'Dois atendimentos sobrepostos na ' || coalesce(p.local_a,'mesma sala') || ' (' END ||
        coalesce(to_char(p.data,'DD/MM/YYYY'), 'toda semana, ' ||
          (ARRAY['domingo','segunda','terça','quarta','quinta','sexta','sábado'])[p.dia+1]) || ': ' ||
        to_char(p.ini_a,'HH24:MI') || '–' || to_char(p.fim_a,'HH24:MI') || ' e ' ||
        to_char(p.ini_b,'HH24:MI') || '–' || to_char(p.fim_b,'HH24:MI') || ').',
      p.aluno_id,
      jsonb_build_object('agenda_ids', jsonb_build_array(p.id_a, p.id_b), 'data', p.data, 'dia_semana', p.dia)
    FROM pares p
    ON CONFLICT DO NOTHING RETURNING subtipo
  )
  SELECT count(*) FILTER (WHERE subtipo='conflito_profissional'), count(*) FILTER (WHERE subtipo='conflito_sala')
    INTO v_prof, v_sala FROM novos;

  RETURN jsonb_build_object('plano_sem_nutricao', v_nutri, 'plano_sem_fisioterapia', v_fisio,
    'conflito_profissional', v_prof, 'conflito_sala', v_sala, 'executado_em', now());
END;
$function$;