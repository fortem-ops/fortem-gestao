CREATE OR REPLACE FUNCTION public.fn_portal_ocupacao_treinos(p_data date)
RETURNS TABLE (
  slot_id uuid,
  ocupadas integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.slot_id,
    COUNT(*)::integer AS ocupadas
  FROM public.treino_agendamentos a
  WHERE auth.uid() IS NOT NULL
    AND a.data = p_data
    AND a.status IN ('agendado', 'confirmado', 'realizado', 'faltou')
  GROUP BY a.slot_id;
$$;

REVOKE ALL ON FUNCTION public.fn_portal_ocupacao_treinos(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_portal_ocupacao_treinos(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_portal_ocupacao_servicos(
  p_profissional_ids uuid[],
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  profissional_id uuid,
  data_especifica date,
  horario_inicio time without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    s.profissional_id,
    s.data_especifica,
    s.horario_inicio
  FROM public.agenda_servicos s
  WHERE auth.uid() IS NOT NULL
    AND s.aluno_id IS NOT NULL
    AND s.profissional_id = ANY(p_profissional_ids)
    AND s.data_especifica >= p_data_inicio
    AND s.data_especifica <= p_data_fim;
$$;

REVOKE ALL ON FUNCTION public.fn_portal_ocupacao_servicos(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_portal_ocupacao_servicos(uuid[], date, date) TO authenticated, service_role;