CREATE TABLE IF NOT EXISTS public.rate_limit_parceiro_login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_login text NOT NULL,
  janela_min bigint NOT NULL,
  contagem int NOT NULL DEFAULT 1,
  bloqueado_ate timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_login, janela_min)
);

GRANT ALL ON public.rate_limit_parceiro_login TO service_role;

ALTER TABLE public.rate_limit_parceiro_login ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratelimit_block_all"
  ON public.rate_limit_parceiro_login
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.fn_parceiro_login(p_email text, p_senha text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _parceiro public.parceiros%ROWTYPE;
  _email    text := lower(trim(p_email));
  _janela   bigint := floor(extract(epoch from now()) / 900);
  _rl       public.rate_limit_parceiro_login%ROWTYPE;
  _contagem int;
  _erro_generico constant text := 'E-mail ou senha inválidos';
BEGIN
  SELECT * INTO _rl
  FROM public.rate_limit_parceiro_login
  WHERE email_login = _email
    AND janela_min = _janela;

  IF _rl.bloqueado_ate IS NOT NULL AND _rl.bloqueado_ate > now() THEN
    INSERT INTO public.audit_log (tabela, registro_id, operacao, dados_depois)
    VALUES ('parceiros', _email, 'login_bloqueado',
            jsonb_build_object('email', _email, 'resultado', 'bloqueado', 'em', now()));
    RETURN jsonb_build_object('ok', false, 'erro', 'Muitas tentativas. Tente novamente em alguns minutos.');
  END IF;

  SELECT * INTO _parceiro
  FROM public.parceiros
  WHERE lower(email_login) = _email
    AND ativo = true;

  IF NOT FOUND
     OR _parceiro.senha_hash IS NULL
     OR _parceiro.senha_hash <> extensions.crypt(p_senha, _parceiro.senha_hash) THEN

    INSERT INTO public.rate_limit_parceiro_login (email_login, janela_min, contagem)
    VALUES (_email, _janela, 1)
    ON CONFLICT (email_login, janela_min)
    DO UPDATE SET contagem = public.rate_limit_parceiro_login.contagem + 1
    RETURNING contagem INTO _contagem;

    IF _contagem >= 5 THEN
      UPDATE public.rate_limit_parceiro_login
      SET bloqueado_ate = now() + interval '15 minutes'
      WHERE email_login = _email AND janela_min = _janela;
    END IF;

    INSERT INTO public.audit_log (tabela, registro_id, operacao, dados_depois)
    VALUES ('parceiros', _email, 'login_falha',
            jsonb_build_object('email', _email, 'resultado', 'falha',
                               'tentativas', _contagem, 'em', now()));

    RETURN jsonb_build_object('ok', false, 'erro', _erro_generico);
  END IF;

  DELETE FROM public.rate_limit_parceiro_login WHERE email_login = _email;

  UPDATE public.parceiros SET ultimo_acesso = now() WHERE id = _parceiro.id;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, dados_depois)
  VALUES ('parceiros', _parceiro.id::text, 'login_sucesso',
          jsonb_build_object('email', _email, 'resultado', 'sucesso', 'em', now()));

  RETURN jsonb_build_object(
    'ok', true,
    'parceiro_id', _parceiro.id,
    'nome', _parceiro.nome,
    'categoria', _parceiro.categoria,
    'modo_validacao', _parceiro.modo_validacao
  );
END;
$function$;