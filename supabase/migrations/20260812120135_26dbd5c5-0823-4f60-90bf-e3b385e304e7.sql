CREATE TABLE public.corrida_inscricoes_prova (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rota text NOT NULL,
  aluno_id uuid NULL REFERENCES public.alunos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  sobrenome text NOT NULL,
  email text NOT NULL,
  cpf_hash text NOT NULL,
  cpf_encrypted bytea NOT NULL,
  cpf_ultimos3 text NOT NULL,
  data_nascimento date NOT NULL,
  telefone text NOT NULL,
  endereco_completo text NOT NULL,
  ritmo_corrida text NOT NULL,
  local_nascimento text NOT NULL,
  participou_nb_2026 boolean NULL,
  participou_mipoa_2026 boolean NULL,
  marca_tenis text NOT NULL,
  como_soube text NOT NULL,
  camiseta_nb text NULL,
  camiseta_mipoa text NULL,
  provas jsonb NOT NULL,
  aceite_inscricao boolean NOT NULL,
  aceite_termo_aptidao boolean NULL,
  pedido_resumo jsonb NOT NULL,
  status text NOT NULL DEFAULT 'recebido',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.corrida_inscricoes_prova TO authenticated;
GRANT ALL ON public.corrida_inscricoes_prova TO service_role;

ALTER TABLE public.corrida_inscricoes_prova ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscricoes_prova_staff_select"
ON public.corrida_inscricoes_prova
FOR SELECT TO authenticated
USING (public.is_staff());

CREATE TRIGGER trg_corrida_inscricoes_prova_updated_at
BEFORE UPDATE ON public.corrida_inscricoes_prova
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rate_limit_corrida_inscricao (
  ip_address text NOT NULL,
  janela_min bigint NOT NULL,
  contagem integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_address, janela_min)
);

GRANT ALL ON public.rate_limit_corrida_inscricao TO service_role;

ALTER TABLE public.rate_limit_corrida_inscricao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_corrida_inscricao_service_only"
ON public.rate_limit_corrida_inscricao
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fn_inserir_inscricao_prova(
  p_rota text,
  p_aluno_id uuid,
  p_nome text,
  p_sobrenome text,
  p_email text,
  p_cpf text,
  p_data_nascimento date,
  p_telefone text,
  p_endereco_completo text,
  p_ritmo_corrida text,
  p_local_nascimento text,
  p_participou_nb_2026 boolean,
  p_participou_mipoa_2026 boolean,
  p_marca_tenis text,
  p_como_soube text,
  p_camiseta_nb text,
  p_camiseta_mipoa text,
  p_provas jsonb,
  p_aceite_inscricao boolean,
  p_aceite_termo_aptidao boolean,
  p_pedido_resumo jsonb
)
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
    data_nascimento, telefone, endereco_completo, ritmo_corrida, local_nascimento,
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
    p_data_nascimento, p_telefone, p_endereco_completo, p_ritmo_corrida, p_local_nascimento,
    p_participou_nb_2026, p_participou_mipoa_2026, p_marca_tenis, p_como_soube,
    p_camiseta_nb, p_camiseta_mipoa, p_provas, p_aceite_inscricao, p_aceite_termo_aptidao, p_pedido_resumo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_inserir_inscricao_prova(text, uuid, text, text, text, text, date, text, text, text, text, boolean, boolean, text, text, text, text, jsonb, boolean, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_inserir_inscricao_prova(text, uuid, text, text, text, text, date, text, text, text, text, boolean, boolean, text, text, text, text, jsonb, boolean, boolean, jsonb) TO service_role;