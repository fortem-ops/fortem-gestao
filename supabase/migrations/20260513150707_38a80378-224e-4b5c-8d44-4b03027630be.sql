
-- When a new comment is added, mark notification as unread for all participants except the comment author
CREATE OR REPLACE FUNCTION public.fn_notif_comment_mark_unread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criador uuid;
BEGIN
  -- Reset visualizado_em for destinatarios that are not the comment author
  UPDATE public.notificacao_destinatarios
     SET visualizado_em = NULL
   WHERE notificacao_id = NEW.notificacao_id
     AND usuario_id <> NEW.usuario_id;

  -- Ensure criador is in destinatarios so they also receive the unread badge when others reply
  SELECT criado_por INTO v_criador FROM public.notificacoes WHERE id = NEW.notificacao_id;
  IF v_criador IS NOT NULL AND v_criador <> NEW.usuario_id THEN
    INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id, status, visualizado_em)
    VALUES (NEW.notificacao_id, v_criador, 'pendente', NULL)
    ON CONFLICT (notificacao_id, usuario_id)
    DO UPDATE SET visualizado_em = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_comment_mark_unread ON public.notificacao_comentarios;
CREATE TRIGGER trg_notif_comment_mark_unread
AFTER INSERT ON public.notificacao_comentarios
FOR EACH ROW
EXECUTE FUNCTION public.fn_notif_comment_mark_unread();
