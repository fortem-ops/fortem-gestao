
-- Trigger: ao revogar a role de professor/admin de um usuário (ou ao excluí-lo, via cascade),
-- desativa automaticamente seus horários de ponto para que ele pare de aparecer no Relatório de Ponto.
CREATE OR REPLACE FUNCTION public.fn_ponto_on_role_revogada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role IN ('professor','admin')
  ) THEN
    UPDATE public.ponto_horarios_professor
    SET ativo = false, updated_at = now()
    WHERE usuario_id = OLD.user_id
      AND ativo = true;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_desligamento_usuario ON public.user_roles;
CREATE TRIGGER trg_ponto_desligamento_usuario
AFTER DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_on_role_revogada();

-- Limpeza pontual: desativar horários de usuários que já não têm role professor/admin
UPDATE public.ponto_horarios_professor h
SET ativo = false, updated_at = now()
WHERE ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = h.usuario_id
      AND r.role IN ('professor','admin')
  );
