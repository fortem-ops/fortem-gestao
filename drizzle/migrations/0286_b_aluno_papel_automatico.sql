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
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'aluno'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id);
  END IF;

  RETURN jsonb_build_object('linked', false, 'reason', 'no_match', 'email', _email);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_alunos_papel_aluno_ao_vincular()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'aluno'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.fn_alunos_papel_aluno_ao_vincular() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_alunos_papel_aluno_ins ON public.alunos;
CREATE TRIGGER trg_alunos_papel_aluno_ins AFTER INSERT ON public.alunos
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL) EXECUTE FUNCTION public.fn_alunos_papel_aluno_ao_vincular();
DROP TRIGGER IF EXISTS trg_alunos_papel_aluno_upd ON public.alunos;
CREATE TRIGGER trg_alunos_papel_aluno_upd AFTER UPDATE OF user_id ON public.alunos
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.fn_alunos_papel_aluno_ao_vincular();