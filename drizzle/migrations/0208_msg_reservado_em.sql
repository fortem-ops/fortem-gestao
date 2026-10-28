ALTER TABLE public.msg_campanha_destinatarios ADD COLUMN IF NOT EXISTS reservado_em timestamptz;
COMMENT ON COLUMN public.msg_campanha_destinatarios.reservado_em IS 'Quando fn_msg_reservar_lote passou a linha para enviando. Linhas presas em enviando há mais de 10 min viram falhou (nunca pendente).';
-- Lote: cada chamada reserva no máximo p_limite (campanha.lote_limite = 50; o primeiro lote é exatamente 50), ordem nome, id.
CREATE OR REPLACE FUNCTION public.fn_msg_reservar_lote(p_campanha uuid, p_limite int)
RETURNS SETOF public.msg_campanha_destinatarios
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE msg_campanha_destinatarios d SET status = 'enviando', reservado_em = now()
  WHERE d.id IN (
    SELECT id FROM msg_campanha_destinatarios
    WHERE campanha_id = p_campanha AND status = 'pendente'
    ORDER BY nome, id LIMIT greatest(1, least(p_limite, 200))
    FOR UPDATE SKIP LOCKED)
  RETURNING d.*;
$$;
REVOKE ALL ON FUNCTION public.fn_msg_reservar_lote(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_msg_reservar_lote(uuid, int) TO service_role;