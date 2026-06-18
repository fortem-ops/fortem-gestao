CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mov record;
  _credito record;
BEGIN
  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = OLD.id AND tipo = 'consumo'
  LOOP
    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito.id IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
    VALUES (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(),
            'Estorno por exclusão de agendamento');
  END LOOP;
  RETURN OLD;
END;
$function$;