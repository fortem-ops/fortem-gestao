ALTER TABLE public.propostas_planos_2027 ADD COLUMN IF NOT EXISTS teste_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.propostas_planos_2027 ADD COLUMN IF NOT EXISTS criado_por uuid;
COMMENT ON COLUMN public.propostas_planos_2027.teste_admin IS 'Proposta de teste marcada por admin logado na prévia. Nunca vira aluno real; na Fase 5 usa o aluno de teste.';

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_teste(p_proposta_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.propostas_planos_2027 WHERE id = p_proposta_id AND teste_admin)
      OR EXISTS (
    SELECT 1 FROM public.propostas_planos_2027 pr, public.sistema_config sc
     WHERE pr.id = p_proposta_id AND sc.chave = 'vendas_2027_teste_aluno_ids'
       AND pr.aluno_id IS NOT NULL AND sc.valor ? pr.aluno_id::text)
$$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_marcar_teste_admin(p_proposta_id uuid, p_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR NOT public.has_role(p_user_id, 'admin'::app_role) THEN RETURN false; END IF;
  UPDATE public.propostas_planos_2027
     SET teste_admin = true, criado_por = p_user_id
   WHERE id = p_proposta_id AND created_at > now() - interval '30 minutes'
     AND (criado_por IS NULL OR criado_por = p_user_id);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_marcar_teste_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_marcar_teste_admin(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_teste(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_teste(uuid) TO service_role;