CREATE OR REPLACE FUNCTION public.fn_admin_testar_resumo_whatsapp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  _amanha date;
  _amanha_iso text;
  _feriado record;
  _count_agendamentos int;
  _profissionais jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer role admin';
  END IF;

  _amanha := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + 1;
  _amanha_iso := _amanha::text;

  SELECT id INTO _feriado FROM public.ponto_feriados WHERE data = _amanha LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'motivo', 'feriado', 'data', _amanha_iso);
  END IF;

  SELECT COUNT(*) INTO _count_agendamentos
  FROM public.agenda_servicos
  WHERE data_especifica = _amanha;

  IF _count_agendamentos = 0 THEN
    RETURN jsonb_build_object('ok', true, 'motivo', 'sem_agendamentos', 'data', _amanha_iso);
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'profissional', p.full_name,
      'telefone', p.phone,
      'agendamentos', sub.lista
    )
  ) INTO _profissionais
  FROM (
    SELECT
      ag.profissional_id as user_id,
      jsonb_agg(
        jsonb_build_object(
          'horario', to_char(ag.horario_inicio::time, 'HH24:MI'),
          'atividade', ag.atividade,
          'aluno', al.nome
        ) ORDER BY ag.horario_inicio
      ) as lista
    FROM public.agenda_servicos ag
    LEFT JOIN public.alunos al ON al.id = ag.aluno_id
    WHERE ag.data_especifica = _amanha
      AND ag.profissional_id IS NOT NULL
    GROUP BY ag.profissional_id
  ) sub
  JOIN public.profiles p ON p.user_id = sub.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'data', _amanha_iso,
    'total_agendamentos', _count_agendamentos,
    'profissionais', COALESCE(_profissionais, '[]'::jsonb)
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.fn_admin_testar_resumo_whatsapp() TO authenticated;