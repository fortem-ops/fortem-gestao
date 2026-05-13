-- Força criado_por = auth.uid() no INSERT, evitando falhas de RLS por inconsistência cliente/servidor
CREATE OR REPLACE FUNCTION public.fn_notif_set_criado_por()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.criado_por := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notif_set_criado_por ON public.notificacoes;
CREATE TRIGGER trg_notif_set_criado_por
BEFORE INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_notif_set_criado_por();