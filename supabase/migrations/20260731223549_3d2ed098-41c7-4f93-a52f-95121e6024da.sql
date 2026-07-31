-- 1) Remove public read of card-linking tokens
DROP POLICY IF EXISTS "links_cartao_public_token" ON public.links_cartao;

-- Safe validator for the public card-registration page
CREATE OR REPLACE FUNCTION public.fn_validar_link_cartao(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'invalido');
  END IF;

  SELECT l.usado, l.expira_em, a.nome
    INTO v_rec
  FROM public.links_cartao l
  LEFT JOIN public.alunos a ON a.id = l.aluno_id
  WHERE l.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'invalido');
  END IF;

  IF v_rec.usado THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'usado');
  END IF;

  IF v_rec.expira_em < now() THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'expirado');
  END IF;

  RETURN jsonb_build_object('valido', true, 'nome', split_part(coalesce(v_rec.nome, ''), ' ', 1));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_validar_link_cartao(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_validar_link_cartao(text) TO anon, authenticated, service_role;

-- 2) Views must enforce the querying user's permissions
ALTER VIEW public.v_funil_conversao SET (security_invoker = on);
ALTER VIEW public.v_crm_pipeline SET (security_invoker = on);