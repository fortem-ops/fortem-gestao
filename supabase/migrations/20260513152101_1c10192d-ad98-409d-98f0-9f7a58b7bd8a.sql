CREATE OR REPLACE FUNCTION public.fn_notif_comment_mark_unread()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_criador uuid;
BEGIN
  UPDATE public.notificacao_destinatarios
     SET visualizado_em = NULL
   WHERE notificacao_id = NEW.notificacao_id
     AND usuario_id <> NEW.usuario_id;

  SELECT criado_por INTO v_criador FROM public.notificacoes WHERE id = NEW.notificacao_id;
  IF v_criador IS NOT NULL AND v_criador <> NEW.usuario_id THEN
    INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id, status, visualizado_em)
    VALUES (NEW.notificacao_id, v_criador, 'nao_visualizada'::public.notif_dest_status, NULL)
    ON CONFLICT (notificacao_id, usuario_id)
    DO UPDATE SET visualizado_em = NULL;
  END IF;

  RETURN NEW;
END;
$function$;