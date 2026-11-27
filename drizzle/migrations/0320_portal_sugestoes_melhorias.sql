CREATE TABLE public.portal_sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('treinos', 'agenda', 'app', 'estrutura', 'atendimento', 'outro')),
  titulo text NOT NULL CHECK (char_length(trim(titulo)) >= 3 AND char_length(titulo) <= 120),
  descricao text NOT NULL CHECK (char_length(trim(descricao)) >= 10 AND char_length(descricao) <= 2000),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  resposta text,
  respondido_por uuid,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_sugestoes_aluno_created
  ON public.portal_sugestoes (aluno_id, created_at DESC);

CREATE INDEX idx_portal_sugestoes_status_created
  ON public.portal_sugestoes (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.portal_sugestoes TO authenticated;
GRANT ALL ON public.portal_sugestoes TO service_role;

ALTER TABLE public.portal_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY aluno_select_own_sugestoes
  ON public.portal_sugestoes
  FOR SELECT
  TO authenticated
  USING (aluno_id = public.fn_current_aluno_id() AND user_id = auth.uid());

CREATE POLICY aluno_insert_own_sugestoes
  ON public.portal_sugestoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    aluno_id = public.fn_current_aluno_id()
    AND user_id = auth.uid()
    AND status = 'pendente'
    AND resposta IS NULL
    AND respondido_por IS NULL
    AND respondido_em IS NULL
  );

CREATE POLICY coord_admin_select_sugestoes
  ON public.portal_sugestoes
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY coord_admin_update_sugestoes
  ON public.portal_sugestoes
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE OR REPLACE FUNCTION public.fn_portal_sugestoes_protect_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at := now();

  IF current_user <> 'service_role'
     AND auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.resposta IS DISTINCT FROM OLD.resposta
       OR NEW.respondido_por IS DISTINCT FROM OLD.respondido_por
       OR NEW.respondido_em IS DISTINCT FROM OLD.respondido_em THEN
      RAISE EXCEPTION 'Apenas coordenadores e administradores podem responder ou alterar o status da sugestão.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_portal_sugestoes_protect_student
  BEFORE UPDATE ON public.portal_sugestoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_portal_sugestoes_protect_student();

CREATE OR REPLACE FUNCTION public.fn_portal_sugestoes_notify_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_aluno_nome text;
  v_notif_id uuid;
BEGIN
  SELECT nome INTO v_aluno_nome
  FROM public.alunos
  WHERE id = NEW.aluno_id;

  INSERT INTO public.notificacoes (titulo, descricao, categoria, criado_por, aluno_id)
  VALUES (
    'Nova sugestão de melhoria de ' || COALESCE(v_aluno_nome, 'aluno'),
    NEW.titulo || ' — Acesse /sugestoes para avaliar e responder.',
    'aluno',
    NEW.user_id,
    NEW.aluno_id
  )
  RETURNING id INTO v_notif_id;

  INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT DISTINCT v_notif_id, ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'coordenador')
    AND ur.user_id <> NEW.user_id
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_portal_sugestoes_notify_staff
  AFTER INSERT ON public.portal_sugestoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_portal_sugestoes_notify_staff();

CREATE OR REPLACE FUNCTION public.fn_responder_sugestao(
  p_sugestao_id uuid,
  p_status text,
  p_resposta text DEFAULT NULL
)
RETURNS public.portal_sugestoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_resposta_limpa text := NULLIF(trim(COALESCE(p_resposta, '')), '');
  v_row public.portal_sugestoes;
  v_titulo_push text;
  v_corpo_push text;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'coordenador')) THEN
    RAISE EXCEPTION 'Apenas coordenadores e administradores podem responder sugestões.';
  END IF;

  IF p_status NOT IN ('aprovada', 'recusada') THEN
    RAISE EXCEPTION 'Status inválido. Use aprovada ou recusada.';
  END IF;

  IF p_status = 'recusada' AND v_resposta_limpa IS NULL THEN
    RAISE EXCEPTION 'Informe uma resposta ao recusar a sugestão.';
  END IF;

  UPDATE public.portal_sugestoes
  SET status = p_status,
      resposta = v_resposta_limpa,
      respondido_por = v_uid,
      respondido_em = now(),
      updated_at = now()
  WHERE id = p_sugestao_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugestão não encontrada.';
  END IF;

  INSERT INTO public.audit_log (tabela, acao, registro_id, usuario_id, dados_depois)
  VALUES (
    'portal_sugestoes',
    'UPDATE',
    v_row.id,
    v_uid,
    jsonb_build_object(
      'status', v_row.status,
      'resposta', v_row.resposta,
      'respondido_em', v_row.respondido_em
    )
  );

  v_titulo_push := CASE
    WHEN p_status = 'aprovada' THEN 'Sua sugestão foi aprovada'
    ELSE 'Sua sugestão foi respondida'
  END;

  v_corpo_push := CASE
    WHEN v_resposta_limpa IS NOT NULL THEN left(v_resposta_limpa, 180)
    ELSE 'Confira o retorno da equipe sobre "' || left(v_row.titulo, 80) || '".'
  END;

  BEGIN
    PERFORM public.fn_call_edge_function(
      'send-push-notification',
      jsonb_build_object(
        'aluno_id', v_row.aluno_id,
        'title', v_titulo_push,
        'body', v_corpo_push,
        'url', '/portal/sugestoes',
        'gatilho', 'sugestao_respondida',
        'referencia', 'sugestao:' || v_row.id::text || ':' || p_status
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_responder_sugestao(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_responder_sugestao(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_responder_sugestao(uuid, text, text) TO service_role;
