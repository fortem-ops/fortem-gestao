CREATE OR REPLACE FUNCTION public.alunos_block_self_sensitive_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Sem sessão de usuário (service role / manutenção) -> permitir
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_staff() OR public.is_coordinator_or_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     OR NEW.current_pipeline_stage_id IS DISTINCT FROM OLD.current_pipeline_stage_id
     OR NEW.frequencia_semanal IS DISTINCT FROM OLD.frequencia_semanal
     OR NEW.cpf_hash IS DISTINCT FROM OLD.cpf_hash
     OR NEW.cpf_encrypted IS DISTINCT FROM OLD.cpf_encrypted
     OR NEW.cpf_ultimos3 IS DISTINCT FROM OLD.cpf_ultimos3
  THEN
    RAISE EXCEPTION 'Alunos não podem alterar campos sensíveis do próprio cadastro';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF OLD.user_id IS NULL
       AND NEW.user_id = auth.uid()
       AND lower(trim(NEW.email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Alunos não podem alterar campos sensíveis do próprio cadastro';
  END IF;

  RETURN NEW;
END;
$function$;

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
  _erro text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id INTO _aluno_id FROM public.alunos WHERE user_id = _uid LIMIT 1;
  IF _aluno_id IS NOT NULL THEN
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id, 'already', true);
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_email');
  END IF;

  BEGIN
    UPDATE public.alunos
       SET user_id = _uid, updated_at = now()
     WHERE lower(email) = lower(_email) AND user_id IS NULL
     RETURNING id INTO _aluno_id;
  EXCEPTION WHEN OTHERS THEN
    _erro := SQLERRM;
    INSERT INTO public.system_logs (modulo, acao, mensagem, user_id, payload)
    VALUES ('portal-link-aluno', 'erro_vinculo', _erro, _uid,
            jsonb_build_object('reason', 'erro_vinculo', 'sqlstate', SQLSTATE));
    RETURN jsonb_build_object('linked', false, 'reason', 'erro_vinculo', 'detalhe', _erro);
  END;

  IF _aluno_id IS NOT NULL THEN
    -- Explícito nas colunas para evitar ambiguidade com índices parciais
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'aluno'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id);
  END IF;

  RETURN jsonb_build_object('linked', false, 'reason', 'no_match', 'email', _email);
END $function$;