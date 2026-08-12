CREATE OR REPLACE FUNCTION public.fn_reveal_inscricao_cpf(p_inscricao_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_cpf text;
BEGIN
  IF NOT (public.is_admin_role() OR public.is_coordenador_ou_admin()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin ou coordenador podem revelar o CPF';
  END IF;

  SELECT extensions.pgp_sym_decrypt(
    cpf_encrypted,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cpf_encryption_key')
  ) INTO v_cpf
  FROM public.corrida_inscricoes_prova
  WHERE id = p_inscricao_id;

  IF v_cpf IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_log (user_id, operacao, tabela, registro_id, dados_depois)
  VALUES (
    auth.uid(),
    'REVEAL_CPF',
    'corrida_inscricoes_prova',
    p_inscricao_id::text,
    jsonb_build_object('papel', CASE WHEN public.is_admin_role() THEN 'admin' ELSE 'coordenador' END)
  );

  RETURN v_cpf;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_reveal_inscricao_cpf(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reveal_inscricao_cpf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reveal_inscricao_cpf(uuid) TO service_role;