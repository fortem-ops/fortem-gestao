CREATE OR REPLACE FUNCTION public.fn_portal_link_aluno()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _aluno_id uuid;
  _outro_aluno_id uuid;
  _outro_aluno_nome text;
  _outro_uid uuid;
  _erro text;
  _motivo text;
  _titulo text;
  _descricao text;
  _criador uuid;
  _notif_id uuid;
  _ja_avisou_hoje boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id INTO _aluno_id FROM public.alunos WHERE user_id = _uid LIMIT 1;
  IF _aluno_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'aluno'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id, 'already', true);
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_email');
  END IF;

  BEGIN
    UPDATE public.alunos
       SET user_id = _uid, updated_at = now()
     WHERE lower(trim(email)) = lower(trim(_email)) AND user_id IS NULL
     RETURNING id INTO _aluno_id;
  EXCEPTION WHEN OTHERS THEN
    _erro := SQLERRM;
    _motivo := 'erro_vinculo';
    INSERT INTO public.system_logs (modulo, acao, mensagem, user_id, payload)
    VALUES ('portal-link-aluno', 'erro_vinculo', _erro, _uid,
            jsonb_build_object('reason', 'erro_vinculo', 'email', _email, 'sqlstate', SQLSTATE));

    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM public.system_logs
        WHERE modulo = 'portal-link-aluno'
          AND acao = 'aviso_admin_enviado'
          AND user_id = _uid
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      ) INTO _ja_avisou_hoje;

      IF NOT _ja_avisou_hoje THEN
        SELECT ur.user_id INTO _criador FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
        _titulo := 'Portal: erro ao vincular conta (' || _email || ')';
        _descricao := 'O usuário ' || _email || ' tentou acessar o Portal do Aluno, mas ocorreu um erro ao vincular o cadastro: ' || left(_erro, 300);
        INSERT INTO public.notificacoes (titulo, descricao, categoria, prioridade, tipo, status, criado_por)
        VALUES (_titulo, _descricao, 'aluno', 'alta', 'simples', 'nao_visualizada', coalesce(_criador, _uid))
        RETURNING id INTO _notif_id;
        INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
        SELECT DISTINCT _notif_id, ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin';
        INSERT INTO public.system_logs (modulo, acao, mensagem, user_id, payload)
        VALUES ('portal-link-aluno', 'aviso_admin_enviado', _titulo, _uid,
                jsonb_build_object('notificacao_id', _notif_id, 'reason', _motivo, 'email', _email));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object('linked', false, 'reason', 'erro_vinculo', 'email', _email, 'detalhe', _erro);
  END;

  IF _aluno_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'aluno'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id);
  END IF;

  -- Caso especial: e-mail existe em alunos, mas já está vinculado a outro usuário de login
  SELECT id, nome, user_id
    INTO _outro_aluno_id, _outro_aluno_nome, _outro_uid
  FROM public.alunos
  WHERE lower(trim(email)) = lower(trim(_email))
    AND user_id IS NOT NULL
    AND user_id <> _uid
  LIMIT 1;

  IF _outro_aluno_id IS NOT NULL THEN
    _motivo := 'ja_vinculado_outra_conta';
    INSERT INTO public.system_logs (modulo, acao, mensagem, user_id, payload)
    VALUES (
      'portal-link-aluno',
      'ja_vinculado_outra_conta',
      'E-mail já vinculado a outra conta de login',
      _uid,
      jsonb_build_object(
        'reason', _motivo,
        'email', _email,
        'aluno_id', _outro_aluno_id,
        'outro_user_id', _outro_uid
      )
    );
    _titulo := 'Portal: e-mail já vinculado a outra conta (' || _email || ')';
    _descricao := 'O usuário ' || _email || ' tentou entrar no Portal do Aluno, mas o cadastro de ' || coalesce(_outro_aluno_nome, 'aluno') || ' já está vinculado a outra conta de login. Revise o vínculo na ficha do aluno.';
  ELSE
    _motivo := 'no_match';
    INSERT INTO public.system_logs (modulo, acao, mensagem, user_id, payload)
    VALUES (
      'portal-link-aluno',
      'no_match',
      'Nenhum cadastro de aluno encontrado para o e-mail',
      _uid,
      jsonb_build_object('reason', _motivo, 'email', _email)
    );
    _titulo := 'Portal: acesso sem cadastro vinculado (' || _email || ')';
    _descricao := 'O usuário ' || _email || ' entrou no Portal do Aluno, mas não há cadastro de aluno com esse e-mail para vincular.';
  END IF;

  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.system_logs
      WHERE modulo = 'portal-link-aluno'
        AND acao = 'aviso_admin_enviado'
        AND user_id = _uid
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ) INTO _ja_avisou_hoje;

    IF NOT _ja_avisou_hoje THEN
      SELECT ur.user_id INTO _criador FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
      INSERT INTO public.notificacoes (titulo, descricao, categoria, prioridade, tipo, status, criado_por, aluno_id)
      VALUES (_titulo, _descricao, 'aluno', 'alta', 'simples', 'nao_visualizada', coalesce(_criador, _uid), _outro_aluno_id)
      RETURNING id INTO _notif_id;
      INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
      SELECT DISTINCT _notif_id, ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin';
      INSERT INTO public.system_logs (modulo, acao, mensagem, user_id, payload)
      VALUES ('portal-link-aluno', 'aviso_admin_enviado', _titulo, _uid,
              jsonb_build_object('notificacao_id', _notif_id, 'reason', _motivo, 'email', _email, 'aluno_id', _outro_aluno_id));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('linked', false, 'reason', _motivo, 'email', _email);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_admin_alunos_vinculo_integridade()
 RETURNS TABLE (
   aluno_id uuid,
   nome text,
   aluno_email text,
   user_id uuid,
   auth_email text,
   motivo text
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS aluno_id,
    a.nome,
    a.email AS aluno_email,
    a.user_id,
    u.email::text AS auth_email,
    CASE
      WHEN lower(trim(coalesce(u.email, ''))) LIKE '%@fortem.app' THEN 'conta_teste_fortem_app'
      ELSE 'email_divergente'
    END AS motivo
  FROM public.alunos a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.user_id IS NOT NULL
    AND (
      lower(trim(coalesce(u.email, ''))) LIKE '%@fortem.app'
      OR lower(trim(coalesce(a.email, ''))) <> lower(trim(coalesce(u.email, '')))
    )
  ORDER BY a.nome;
END $function$;

REVOKE ALL ON FUNCTION public.fn_admin_alunos_vinculo_integridade() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_alunos_vinculo_integridade() TO authenticated, service_role;