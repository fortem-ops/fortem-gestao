ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS desativado_por uuid;

-- Somente admin (ou serviço) muda o estado de ativação do perfil
CREATE OR REPLACE FUNCTION public.fn_profiles_protege_ativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.ativo IS DISTINCT FROM OLD.ativo
      OR NEW.desativado_em IS DISTINCT FROM OLD.desativado_em
      OR NEW.desativado_por IS DISTINCT FROM OLD.desativado_por)
     AND auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores podem ativar ou desativar usuários';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_protege_ativo ON public.profiles;
CREATE TRIGGER trg_profiles_protege_ativo BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_protege_ativo();

CREATE OR REPLACE FUNCTION public.fn_profiles_protege_ativo_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ativo = false AND auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    NEW.ativo := true; NEW.desativado_em := NULL; NEW.desativado_por := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_protege_ativo_ins ON public.profiles;
CREATE TRIGGER trg_profiles_protege_ativo_ins BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_protege_ativo_insert();

-- Acesso cortado quando o perfil está explicitamente desativado
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  ) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND ativo = false)
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_staff(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND ativo = false);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_role()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_admin(auth.uid());
$function$;

-- Trava: nunca apagar a última permissão de administrador
CREATE OR REPLACE FUNCTION public.fn_user_roles_protege_ultimo_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin' AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'Não é possível remover a última permissão de Administrador do sistema';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_user_roles_protege_ultimo_admin ON public.user_roles;
CREATE TRIGGER trg_user_roles_protege_ultimo_admin BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_user_roles_protege_ultimo_admin();

-- Cadastro de equipe para a porta facial
CREATE OR REPLACE FUNCTION public.fn_equipe_garantir_cadastro(p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int; _id uuid; _nome text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não informado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('equipe_cadastro:' || p_user_id::text));
  SELECT count(*) INTO _n FROM public.alunos WHERE user_id = p_user_id;
  IF _n > 1 THEN
    RAISE EXCEPTION 'Este usuário está vinculado a % cadastros em alunos; resolva a duplicidade antes de continuar', _n;
  END IF;
  IF _n = 1 THEN
    SELECT id INTO _id FROM public.alunos WHERE user_id = p_user_id;
    RETURN _id;
  END IF;
  SELECT NULLIF(trim(full_name), '') INTO _nome FROM public.profiles WHERE user_id = p_user_id;
  IF _nome IS NULL THEN RAISE EXCEPTION 'Usuário sem perfil com nome'; END IF;
  INSERT INTO public.alunos (nome, status, is_equipe, user_id)
  VALUES (_nome, 'ativo', true, p_user_id) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_equipe_definir_nascimento(p_user_id uuid, p_data date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores';
  END IF;
  IF p_data IS NULL OR p_data > current_date OR p_data < date '1900-01-01' THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END IF;
  _id := public.fn_equipe_garantir_cadastro(p_user_id);
  UPDATE public.alunos SET data_nascimento = p_data WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.fn_equipe_garantir_cadastro(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.fn_equipe_definir_nascimento(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_garantir_cadastro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_equipe_definir_nascimento(uuid, date) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_profiles_protege_ativo() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_profiles_protege_ativo_insert() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_user_roles_protege_ultimo_admin() FROM public, anon, authenticated;