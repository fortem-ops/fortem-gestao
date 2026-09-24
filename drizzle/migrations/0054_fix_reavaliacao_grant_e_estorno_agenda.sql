CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_credito_por_agenda(_agenda_id uuid, _motivo text DEFAULT 'Reposição — aluno alterado no agendamento'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _mov record;
  _credito record;
BEGIN
  -- O consumo é removido junto com a devolução do uso; não gravamos um "estorno"
  -- avulso, pois sem o consumo correspondente o histórico ficaria negativo.
  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = _agenda_id AND tipo = 'consumo'
  LOOP
    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito.id IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;
  END LOOP;

  DELETE FROM public.creditos_movimentos WHERE agenda_id = _agenda_id AND tipo = 'consumo';
  DELETE FROM public.consumo_servicos WHERE agenda_id = _agenda_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_criar_tarefa_reavaliacao_app(_aluno_id uuid, _data_ultima date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN public.fn_criar_tarefa_reavaliacao(_aluno_id, _data_ultima, auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_criar_tarefa_reavaliacao_app(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_criar_tarefa_reavaliacao_app(uuid, date) TO authenticated, service_role;