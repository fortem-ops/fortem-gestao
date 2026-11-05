CREATE OR REPLACE FUNCTION public.fn_clube_avaliar_conquistas(p_aluno_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t int; _n int; _r int; _a int; _sem int;
BEGIN
  IF p_aluno_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _t FROM public.treino_agendamentos WHERE aluno_id = p_aluno_id AND status = 'realizado';
  SELECT count(*) FILTER (WHERE a.atividade = 'Nutrição'), count(*) FILTER (WHERE a.atividade = 'Reabilitação')
    INTO _n, _r FROM public.agenda_presencas p JOIN public.agenda_servicos a ON a.id = p.agenda_id
   WHERE a.aluno_id = p_aluno_id AND p.comparecimento = true;
  SELECT count(*) INTO _a FROM public.avaliacoes WHERE aluno_id = p_aluno_id AND tipo IN ('funcional','funcional_v2');

  IF _t >= 10 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '10 Treinos'); END IF;
  IF _t >= 50 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '50 Treinos'); END IF;
  IF _t >= 100 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '100 Treinos'); END IF;
  IF _t >= 250 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '250 Treinos'); END IF;
  IF _t >= 500 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '500 Treinos'); END IF;
  IF _n >= 1 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Primeira Consulta Nutricional'); END IF;
  IF _n >= 4 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Acompanhamento Nutricional'); END IF;
  IF _n >= 8 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Nutrição Consistente'); END IF;
  IF _r >= 1 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Primeira Sessão de Reabilitação'); END IF;
  IF _r >= 5 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Reabilitação em Andamento'); END IF;
  IF _r >= 10 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Reabilitação Concluída'); END IF;
  IF _a >= 1 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Primeira Avaliação'); END IF;
  IF _a >= 2 AND EXISTS (
    SELECT 1 FROM (SELECT data, lag(data) OVER (ORDER BY data) ant FROM public.avaliacoes
                    WHERE aluno_id = p_aluno_id AND tipo IN ('funcional','funcional_v2')) x
     WHERE x.ant IS NOT NULL AND x.data <= (x.ant + interval '6 months')::date) THEN
    PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Avaliação em Dia');
  END IF;
  IF _t > 0 THEN
    _sem := public.fn_clube_semanas_seguidas(p_aluno_id);
    IF _sem >= 8 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '8 Semanas Seguidas'); END IF;
    IF _sem >= 16 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Maratona de Frequência'); END IF;
  END IF;
  IF _t > 0 AND _n > 0 AND _r > 0 AND EXISTS (
    SELECT 1 FROM (SELECT DISTINCT extract(year FROM data)::int y FROM public.treino_agendamentos
                    WHERE aluno_id = p_aluno_id AND status = 'realizado') t
     WHERE EXISTS (SELECT 1 FROM public.agenda_presencas p JOIN public.agenda_servicos a ON a.id = p.agenda_id
                    WHERE a.aluno_id = p_aluno_id AND p.comparecimento AND a.atividade = 'Nutrição' AND extract(year FROM p.data)::int = t.y)
       AND EXISTS (SELECT 1 FROM public.agenda_presencas p JOIN public.agenda_servicos a ON a.id = p.agenda_id
                    WHERE a.aluno_id = p_aluno_id AND p.comparecimento AND a.atividade = 'Reabilitação' AND extract(year FROM p.data)::int = t.y)) THEN
    PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Fortem Completo');
  END IF;
  -- Mês Completo: semanas ISO (seg-dom) inteiramente dentro de um mês-calendário; pelo menos 1 treino realizado em cada uma.
  -- Semanas parciais no começo/fim do mês não contam (nem exigem treino). Consultoria fora de sequências de semanas.
  IF _t > 0 AND coalesce(public.fn_clube_plano_info(p_aluno_id)->>'chave', '') <> 'consultoria' AND EXISTS (
    SELECT 1 FROM (SELECT DISTINCT date_trunc('month', data)::date m FROM public.treino_agendamentos
                    WHERE aluno_id = p_aluno_id AND status = 'realizado') mm
     WHERE NOT EXISTS (
       SELECT 1 FROM generate_series(mm.m, (mm.m + interval '1 month - 1 day')::date, interval '1 day') g(d)
        WHERE extract(isodow FROM g.d) = 1 AND (g.d::date + 6) < (mm.m + interval '1 month')::date
          AND NOT EXISTS (SELECT 1 FROM public.treino_agendamentos t WHERE t.aluno_id = p_aluno_id AND t.status = 'realizado'
                           AND t.data BETWEEN g.d::date AND g.d::date + 6))) THEN
    PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Mês Completo');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.fn_clube_avaliar_conquistas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clube_avaliar_conquistas(uuid) TO service_role;

UPDATE public.clube_badges SET descricao = 'Concedida ao treinar em todas as semanas completas (segunda a domingo) de um mesmo mês.', criterio = 'todas as semanas ISO completas do mês com treino realizado' WHERE codigo = 'mes_completo';

-- Carga inicial sem pontos: corte movido para agora durante a carga e restaurado em seguida.
DO $$ DECLARE _orig text; r record; BEGIN
  SELECT valor INTO _orig FROM public.clube_config WHERE chave = 'conquistas_bonus_desde';
  UPDATE public.clube_config SET valor = now()::text WHERE chave = 'conquistas_bonus_desde';
  FOR r IN SELECT DISTINCT aluno_id FROM public.treino_agendamentos WHERE status = 'realizado' LOOP
    PERFORM public.fn_clube_avaliar_conquistas(r.aluno_id);
  END LOOP;
  UPDATE public.clube_config SET valor = _orig WHERE chave = 'conquistas_bonus_desde';
END $$;