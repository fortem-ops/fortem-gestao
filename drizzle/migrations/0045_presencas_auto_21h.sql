CREATE OR REPLACE FUNCTION public.fn_presencas_auto(p_data date, p_obs text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.agenda_presencas (agenda_id, data, comparecimento, marcado_por, observacao)
  SELECT s.id, p_data, true, NULL, p_obs
  FROM public.agenda_servicos s
  WHERE s.aluno_id IS NOT NULL
    AND coalesce(s.atividade,'') NOT ILIKE 'Treino Experimental%'
    AND (
      (s.tipo = 'avulso' AND s.data_especifica = p_data)
      OR (s.tipo = 'fixo' AND s.dia_semana = extract(dow FROM p_data)::int
          AND (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data
          AND NOT EXISTS (SELECT 1 FROM public.agenda_servicos_excecoes e
                          WHERE e.agenda_id = s.id AND e.data_excecao = p_data))
    )
  ON CONFLICT (agenda_id, data) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.fn_presencas_auto_21h()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_presencas_auto((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'Presença automática 21:00');
$$;

REVOKE ALL ON FUNCTION public.fn_presencas_auto(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_presencas_auto_21h() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_presencas_auto(date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_presencas_auto_21h() TO service_role;