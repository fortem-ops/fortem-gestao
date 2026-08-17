CREATE OR REPLACE FUNCTION public.fn_ponto_gerar_fechamentos_mes(_mes date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _user record;
  _coord record;
  _count int := 0;
  _label text;
  _fim date := (date_trunc('month', _mes) + interval '1 month - 1 day')::date;
BEGIN
  _label := to_char(date_trunc('month', _mes), 'MM/YYYY');

  FOR _user IN
    SELECT DISTINCT u.user_id FROM (
      SELECT user_id FROM public.user_roles WHERE role = 'professor'
      UNION
      SELECT usuario_id FROM public.ponto_horarios_professor WHERE ativo
      UNION
      SELECT usuario_id FROM public.ponto_jornadas
        WHERE data >= date_trunc('month', _mes)::date AND data <= _fim
    ) u
  LOOP
    PERFORM public.fn_ponto_calcular_fechamento(_user.user_id, _mes);
    _count := _count + 1;
  END LOOP;

  FOR _coord IN SELECT user_id FROM public.user_roles WHERE role IN ('coordenador','admin') LOOP
    INSERT INTO public.tarefas (titulo, descricao, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
    VALUES (
      'Fechamento de Ponto — ' || _label,
      'Revise as jornadas do mês, ajuste pendências e aprove o fechamento.',
      _coord.user_id, _coord.user_id,
      (date_trunc('month', _mes) + interval '1 month + 5 days')::date,
      'alta', true, 'ponto_fechamento'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'professores', _count, 'mes', _mes);
END
$fn$;