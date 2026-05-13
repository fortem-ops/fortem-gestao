REVOKE EXECUTE ON FUNCTION public.fn_user_created_notificacao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_created_notificacao(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_notificar_criar_notificacao(text, text, public.notif_categoria, public.notif_prioridade, public.notif_tipo, timestamptz, uuid, timestamptz, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_notificar_criar_notificacao(text, text, public.notif_categoria, public.notif_prioridade, public.notif_tipo, timestamptz, uuid, timestamptz, text, uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_notif_set_criado_por() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_notif_after_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_notif_dest_visualizado() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_notif_coment_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_notif_status_change() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.fn_user_can_see_notificacao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_can_see_notificacao(uuid, uuid) TO authenticated;