
-- 1) cartoes_salvos: scope admin updates + protect sensitive fields, allow owner self-update
CREATE OR REPLACE FUNCTION public.cartoes_salvos_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aluno_id IS DISTINCT FROM OLD.aluno_id THEN
    RAISE EXCEPTION 'aluno_id is immutable on cartoes_salvos';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.token_rede IS DISTINCT FROM OLD.token_rede
       OR NEW.brand IS DISTINCT FROM OLD.brand
       OR NEW.last4 IS DISTINCT FROM OLD.last4
       OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
       OR NEW.expiration_month IS DISTINCT FROM OLD.expiration_month
       OR NEW.expiration_year IS DISTINCT FROM OLD.expiration_year
       OR NEW.origem IS DISTINCT FROM OLD.origem THEN
      RAISE EXCEPTION 'sensitive card fields are immutable on cartoes_salvos';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS cartoes_update_admin_only ON public.cartoes_salvos;
CREATE POLICY cartoes_update_admin_only
ON public.cartoes_salvos
FOR UPDATE
TO authenticated
USING (
  is_admin_role()
  AND aluno_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = cartoes_salvos.aluno_id)
)
WITH CHECK (
  is_admin_role()
  AND aluno_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = cartoes_salvos.aluno_id)
);

DROP POLICY IF EXISTS cartoes_self_update ON public.cartoes_salvos;
CREATE POLICY cartoes_self_update
ON public.cartoes_salvos
FOR UPDATE
TO authenticated
USING (aluno_id IN (SELECT a.id FROM public.alunos a WHERE a.user_id = auth.uid()))
WITH CHECK (aluno_id IN (SELECT a.id FROM public.alunos a WHERE a.user_id = auth.uid()));

-- 2) notificacao_destinatarios: validate usuario_id is a real app user
DROP POLICY IF EXISTS notif_dest_staff_insert ON public.notificacao_destinatarios;
CREATE POLICY notif_dest_staff_insert
ON public.notificacao_destinatarios
FOR INSERT
TO authenticated
WITH CHECK (
  is_professor_staff()
  AND notificacao_id IN (
    SELECT n.id FROM public.notificacoes n WHERE n.criado_por = auth.uid()
  )
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = usuario_id)
);
