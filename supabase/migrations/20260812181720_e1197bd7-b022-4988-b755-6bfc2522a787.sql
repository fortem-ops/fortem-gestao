ALTER TABLE public.corrida_inscricoes_prova
  DROP COLUMN IF EXISTS endereco_completo,
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logradouro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cidade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.fn_inserir_inscricao_prova(text, uuid, text, text, text, text, date, text, text, text, text, boolean, boolean, text, text, text, text, jsonb, boolean, boolean, jsonb);

CREATE OR REPLACE FUNCTION public.fn_inserir_inscricao_prova(
  p_rota text, p_aluno_id uuid, p_nome text, p_sobrenome text, p_email text, p_cpf text,
  p_data_nascimento date, p_telefone text,
  p_cep text, p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_cidade text, p_uf text,
  p_ritmo_corrida text, p_local_nascimento text,
  p_participou_nb_2026 boolean, p_participou_mipoa_2026 boolean, p_marca_tenis text, p_como_soube text,
  p_camiseta_nb text, p_camiseta_mipoa text, p_provas jsonb, p_aceite_inscricao boolean,
  p_aceite_termo_aptidao boolean, p_pedido_resumo jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_digits text;
  v_id uuid;
BEGIN
  v_digits := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  IF length(v_digits) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido: deve conter 11 dígitos';
  END IF;

  INSERT INTO public.corrida_inscricoes_prova (
    rota, aluno_id, nome, sobrenome, email,
    cpf_hash, cpf_encrypted, cpf_ultimos3,
    data_nascimento, telefone,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    ritmo_corrida, local_nascimento,
    participou_nb_2026, participou_mipoa_2026, marca_tenis, como_soube,
    camiseta_nb, camiseta_mipoa, provas, aceite_inscricao, aceite_termo_aptidao, pedido_resumo
  ) VALUES (
    p_rota, p_aluno_id, p_nome, p_sobrenome, p_email,
    public.fn_clube_hash_cpf(v_digits),
    extensions.pgp_sym_encrypt(
      v_digits,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cpf_encryption_key')
    ),
    right(v_digits, 3),
    p_data_nascimento, p_telefone,
    p_cep, p_logradouro, p_numero, nullif(btrim(coalesce(p_complemento,'')), ''), p_bairro, p_cidade, upper(p_uf),
    p_ritmo_corrida, p_local_nascimento,
    p_participou_nb_2026, p_participou_mipoa_2026, p_marca_tenis, p_como_soube,
    p_camiseta_nb, p_camiseta_mipoa, p_provas, p_aceite_inscricao, p_aceite_termo_aptidao, p_pedido_resumo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;