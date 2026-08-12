INSERT INTO public.servicos_catalogo (nome, atividade, quantidade_sessoes, valor, ativo)
SELECT 'Inscrição em Prova Avulsa (Corrida)', 'corrida', 1, 289.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.servicos_catalogo WHERE nome = 'Inscrição em Prova Avulsa (Corrida)');

CREATE OR REPLACE FUNCTION public.fn_service_set_cpf(p_aluno_id uuid, p_cpf text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_digits text;
BEGIN
  v_digits := regexp_replace(coalesce(p_cpf,''), '[^0-9]', '', 'g');
  IF length(v_digits) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido: deve conter 11 dígitos';
  END IF;

  UPDATE public.alunos
  SET
    cpf_encrypted = extensions.pgp_sym_encrypt(
      v_digits,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cpf_encryption_key')
    ),
    cpf_hash = public.fn_clube_hash_cpf(v_digits),
    cpf_ultimos3 = right(v_digits, 3)
  WHERE id = p_aluno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_service_set_cpf(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_set_cpf(uuid, text) TO service_role;