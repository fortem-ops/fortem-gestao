-- Pela tela (papel authenticated) só se alteram as colunas de moderação; o resto só pelo servidor.
REVOKE UPDATE ON public.fotos_evento FROM authenticated;
GRANT UPDATE (status_moderacao, moderado_por, moderado_em) ON public.fotos_evento TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_fotos_evento_proteger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF (to_jsonb(NEW) - ARRAY['status_moderacao','moderado_por','moderado_em'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status_moderacao','moderado_por','moderado_em']) THEN
      RAISE EXCEPTION 'campo_protegido';
    END IF;
    NEW.moderado_por := auth.uid();
    NEW.moderado_em := now();
  END IF;
  RETURN NEW;
END $$;