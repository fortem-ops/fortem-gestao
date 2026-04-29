
-- 1. Vínculo aluno ↔ auth.users
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;
CREATE INDEX IF NOT EXISTS idx_alunos_user_id ON public.alunos(user_id);

-- 2. Tabela de progresso de treino do aluno
CREATE TABLE IF NOT EXISTS public.student_workout_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  treino_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, treino_id, data)
);
CREATE INDEX IF NOT EXISTS idx_swp_aluno_data ON public.student_workout_progress(aluno_id, data);
ALTER TABLE public.student_workout_progress ENABLE ROW LEVEL SECURITY;

-- 3. Helper: aluno_id do usuário logado
CREATE OR REPLACE FUNCTION public.fn_current_aluno_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.alunos WHERE user_id = auth.uid() LIMIT 1
$$;

-- 4. Vínculo automático no primeiro login
CREATE OR REPLACE FUNCTION public.fn_portal_link_aluno()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _aluno_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_authenticated');
  END IF;

  -- Já vinculado?
  SELECT id INTO _aluno_id FROM public.alunos WHERE user_id = _uid LIMIT 1;
  IF _aluno_id IS NOT NULL THEN
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id, 'already', true);
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_email');
  END IF;

  UPDATE public.alunos
     SET user_id = _uid, updated_at = now()
   WHERE lower(email) = lower(_email) AND user_id IS NULL
   RETURNING id INTO _aluno_id;

  IF _aluno_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'aluno'::public.app_role)
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('linked', true, 'aluno_id', _aluno_id);
  END IF;

  RETURN jsonb_build_object('linked', false, 'reason', 'no_match', 'email', _email);
END $$;

-- 5. RLS para student_workout_progress
CREATE POLICY "Aluno gerencia seu progresso (select)"
ON public.student_workout_progress FOR SELECT TO authenticated
USING (
  aluno_id = public.fn_current_aluno_id()
  OR public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = student_workout_progress.aluno_id AND a.responsavel_id = auth.uid())
);

CREATE POLICY "Aluno insere seu progresso"
ON public.student_workout_progress FOR INSERT TO authenticated
WITH CHECK (aluno_id = public.fn_current_aluno_id());

CREATE POLICY "Aluno apaga seu progresso"
ON public.student_workout_progress FOR DELETE TO authenticated
USING (aluno_id = public.fn_current_aluno_id());

-- 6. RLS adicional para o aluno ver/editar seu próprio cadastro
CREATE POLICY "Aluno atualiza próprio cadastro"
ON public.alunos FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
-- (SELECT já é permitido a authenticated)

-- 7. Permitir ao aluno gerar o próprio QR do Clube
CREATE OR REPLACE FUNCTION public.fn_clube_generate_qr_token(_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _membro record;
  _payload text;
  _signature text;
  _token text;
  _expires_at timestamptz;
  _nonce text;
BEGIN
  IF NOT (
    public.is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos WHERE id = _aluno_id AND responsavel_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos WHERE id = _aluno_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerar QR deste aluno';
  END IF;

  SELECT * INTO _membro FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id;
  IF _membro IS NULL THEN
    RAISE EXCEPTION 'Aluno não é membro do Clube FORTEM';
  END IF;

  _expires_at := now() + interval '30 seconds';
  _nonce := encode(extensions.gen_random_bytes(8), 'hex');
  _payload := encode(
    convert_to(
      jsonb_build_object(
        'aluno_id', _membro.aluno_id,
        'cpf_hash', _membro.cpf_hash,
        'exp', extract(epoch FROM _expires_at)::bigint,
        'nonce', _nonce
      )::text,
      'UTF8'
    ),
    'base64'
  );
  _payload := translate(_payload, E'+/=\n', '-_');
  _signature := translate(encode(extensions.hmac(_payload, _membro.qr_secret, 'sha256'), 'base64'), E'+/=\n', '-_');
  _token := _payload || '.' || _signature;

  UPDATE public.clube_fortem_membros SET ultimo_refresh_qr = now() WHERE id = _membro.id;

  RETURN jsonb_build_object(
    'token', _token,
    'expires_at', _expires_at,
    'fortem_id', _membro.fortem_id,
    'nivel_membro', _membro.nivel_membro,
    'status_membro', _membro.status_membro
  );
END $function$;
