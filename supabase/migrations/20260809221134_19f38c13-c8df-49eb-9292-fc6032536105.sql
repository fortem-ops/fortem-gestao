CREATE OR REPLACE FUNCTION public.fn_treino_agendamento_pontuar_clube()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'realizado' AND (OLD.status IS DISTINCT FROM 'realizado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clube_historico
      WHERE referencia_id = NEW.id AND referencia_tipo = 'treino_agendamento' AND acao = 'treino_realizado'
    ) THEN
      PERFORM public.fn_clube_adicionar_pontos(NEW.aluno_id, 'treino_realizado', NEW.id, 'treino_agendamento');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_treino_realizado_pontuar_clube ON public.treino_agendamentos;

CREATE TRIGGER trg_treino_realizado_pontuar_clube
AFTER UPDATE OF status ON public.treino_agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_treino_agendamento_pontuar_clube();