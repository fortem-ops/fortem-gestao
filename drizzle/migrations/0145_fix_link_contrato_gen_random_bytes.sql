CREATE OR REPLACE FUNCTION public.fn_criar_link_contrato(p_contrato_documento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aluno_id uuid;
  v_token text;
BEGIN
  IF NOT is_coordenador_ou_admin() THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  END IF;

  SELECT aluno_id INTO v_aluno_id
  FROM public.contratos_documentos
  WHERE id = p_contrato_documento_id;

  IF v_aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'documento_nao_encontrado');
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.links_contrato (aluno_id, contrato_documento_id, token, expira_em, criado_por, origem)
  VALUES (v_aluno_id, p_contrato_documento_id, v_token, now() + interval '7 days', auth.uid(), 'admin_manual');

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;
$function$;