CREATE OR REPLACE FUNCTION public.fn_concluir_tarefas_por_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;

  IF lower(COALESCE(NEW.tipo,'')) LIKE '%funcional%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto IN ('avaliacao_funcional_agendada', 'reavaliacao_funcional')
      AND status <> 'concluida';
  ELSIF lower(COALESCE(NEW.tipo,'')) LIKE '%experimental%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'relatorio_experimental';
  END IF;

  RETURN NEW;
END;
$function$;