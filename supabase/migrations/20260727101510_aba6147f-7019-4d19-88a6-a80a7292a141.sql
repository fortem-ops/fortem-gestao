CREATE OR REPLACE FUNCTION public.fn_reveal_cpf_service(p_aluno_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_role text;
  v_cpf text;
BEGIN
  v_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: fn_reveal_cpf_service requer service_role';
  END IF;

  SELECT extensions.pgp_sym_decrypt(
    cpf_encrypted,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cpf_encryption_key')
  ) INTO v_cpf
  FROM public.alunos
  WHERE id = p_aluno_id;

  IF v_cpf IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_log (user_id, operacao, tabela, registro_id, dados_depois)
  VALUES (
    NULL,
    'REVEAL_CPF_SERVICE',
    'alunos',
    p_aluno_id::text,
    jsonb_build_object('papel', 'service_role')
  );

  RETURN v_cpf;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_reveal_cpf_service(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reveal_cpf_service(uuid) TO service_role;