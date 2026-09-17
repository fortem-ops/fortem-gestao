CREATE OR REPLACE FUNCTION public.fn_exercicio_video_conclui_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.video_url IS NOT NULL AND NEW.video_url <> '')
     OR (NEW.video_path IS NOT NULL AND NEW.video_path <> '') THEN
    DELETE FROM public.tarefas
    WHERE tipo_auto = 'gravar_video'
      AND descricao = 'exercicio_id:' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exercicio_video_conclui_tarefa ON public.exercicios_personalizados;

CREATE TRIGGER trg_exercicio_video_conclui_tarefa
AFTER INSERT OR UPDATE OF video_url, video_path ON public.exercicios_personalizados
FOR EACH ROW
EXECUTE FUNCTION public.fn_exercicio_video_conclui_tarefa();