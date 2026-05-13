-- Corrige a política de criação de notificações: o trigger força criado_por = auth.uid(),
-- então a regra deve validar apenas que há um usuário autenticado.
DROP POLICY IF EXISTS "Insert own notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Authenticated can create notificacoes" ON public.notificacoes;

CREATE POLICY "Authenticated can create notificacoes"
ON public.notificacoes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Helper SECURITY DEFINER para políticas que precisam confirmar autoria
-- sem depender de subconsultas afetadas por RLS na própria política.
CREATE OR REPLACE FUNCTION public.fn_user_created_notificacao(_notif_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notificacoes n
    WHERE n.id = _notif_id
      AND n.criado_por = _user_id
  )
$$;

-- Recria a política de destinatários usando o helper seguro.
DROP POLICY IF EXISTS "Insert dest by criador or coord" ON public.notificacao_destinatarios;

CREATE POLICY "Insert dest by criador or coord"
ON public.notificacao_destinatarios
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_coordinator_or_admin(auth.uid())
  OR public.fn_user_created_notificacao(notificacao_id, auth.uid())
);

-- RPC segura para criar notificação + destinatários em uma única operação no backend.
CREATE OR REPLACE FUNCTION public.fn_notificar_criar_notificacao(
  p_titulo text,
  p_descricao text,
  p_categoria public.notif_categoria,
  p_prioridade public.notif_prioridade,
  p_tipo public.notif_tipo,
  p_prazo timestamptz DEFAULT NULL,
  p_aluno_id uuid DEFAULT NULL,
  p_reuniao_data timestamptz DEFAULT NULL,
  p_reuniao_local text DEFAULT NULL,
  p_destinatarios uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _notif_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF length(trim(coalesce(p_titulo, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe um título';
  END IF;

  IF length(trim(coalesce(p_descricao, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe a descrição';
  END IF;

  INSERT INTO public.notificacoes (
    titulo,
    descricao,
    categoria,
    prioridade,
    tipo,
    prazo,
    aluno_id,
    reuniao_data,
    reuniao_local,
    criado_por
  ) VALUES (
    trim(p_titulo),
    trim(p_descricao),
    p_categoria,
    p_prioridade,
    p_tipo,
    p_prazo,
    p_aluno_id,
    p_reuniao_data,
    nullif(trim(coalesce(p_reuniao_local, '')), ''),
    _uid
  )
  RETURNING id INTO _notif_id;

  INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT _notif_id, recipient.usuario_id
  FROM (
    SELECT DISTINCT unnest(coalesce(p_destinatarios, ARRAY[]::uuid[])) AS usuario_id
  ) AS recipient
  WHERE recipient.usuario_id IS NOT NULL
    AND recipient.usuario_id <> _uid
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = recipient.usuario_id
        AND ur.role = ANY (ARRAY[
          'admin'::public.app_role,
          'coordenador'::public.app_role,
          'professor'::public.app_role,
          'nutricionista'::public.app_role,
          'fisioterapeuta'::public.app_role
        ])
    )
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;

  RETURN _notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_notificar_criar_notificacao(
  text,
  text,
  public.notif_categoria,
  public.notif_prioridade,
  public.notif_tipo,
  timestamptz,
  uuid,
  timestamptz,
  text,
  uuid[]
) TO authenticated;