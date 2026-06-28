-- Permitir self-update apenas se a linha ainda não tem ciência registrada
CREATE POLICY "ponto_fechamentos_self_ciencia_update"
  ON public.ponto_fechamentos_mensais
  FOR UPDATE
  USING (usuario_id = auth.uid() AND ciencia_colaborador_em IS NULL)
  WITH CHECK (usuario_id = auth.uid());

-- Trigger guarda: quando o próprio usuário atualiza (não coord/admin),
-- só pode alterar ciencia_colaborador_em e ciencia_colaborador_ip.
CREATE OR REPLACE FUNCTION public.fn_ponto_fechamento_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Se quem está executando é coord/admin, permitir tudo
  IF public.is_coordenador_ou_admin() THEN
    RETURN NEW;
  END IF;

  -- Caso contrário (próprio colaborador), só pode mexer nos campos de ciência
  IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
     OR NEW.mes IS DISTINCT FROM OLD.mes
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_minutos IS DISTINCT FROM OLD.total_minutos
     OR NEW.minutos_extras IS DISTINCT FROM OLD.minutos_extras
     OR NEW.minutos_faltantes IS DISTINCT FROM OLD.minutos_faltantes
     OR NEW.pendencias_count IS DISTINCT FROM OLD.pendencias_count
  THEN
    RAISE EXCEPTION 'Colaborador só pode registrar ciência do próprio fechamento.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_ponto_fechamento_guard_self_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_ponto_fechamento_guard_self_update ON public.ponto_fechamentos_mensais;
CREATE TRIGGER trg_ponto_fechamento_guard_self_update
  BEFORE UPDATE ON public.ponto_fechamentos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_fechamento_guard_self_update();