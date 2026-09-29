DROP FUNCTION IF EXISTS public.fn_planos_divergencia_contrato();
CREATE FUNCTION public.fn_planos_divergencia_contrato()
 RETURNS TABLE(plano_id uuid, aluno_id uuid, aluno_nome text, tipo text, plano_data_fim date, contrato_id uuid, contrato_data_fim date, motivo text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.aluno_id, a.nome, p.tipo,
         CASE WHEN p.renovacao_automatica THEN p.proxima_renovacao ELSE p.data_fim END,
         c.id, c.data_fim,
         CASE WHEN p.renovacao_automatica THEN 'renovacao_diferente'
              WHEN p.data_fim IS NULL THEN 'plano_sem_fim'
              ELSE 'data_fim_diferente' END
  FROM public.planos p
  JOIN public.contratos c ON c.plano_id = p.id AND c.status = 'ativo'
  JOIN public.alunos a ON a.id = p.aluno_id
  WHERE p.ativo AND p.atividade = 'treinamento_funcional'
    AND coalesce(CASE WHEN p.renovacao_automatica THEN p.proxima_renovacao ELSE p.data_fim END, DATE '2100-01-01')
        <> coalesce(c.data_fim, DATE '2100-01-01')
    AND public.is_coordinator_or_admin(auth.uid())
  ORDER BY a.nome;
$$;
REVOKE ALL ON FUNCTION public.fn_planos_divergencia_contrato() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_planos_divergencia_contrato() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_alinhar_plano_ao_contrato(p_plano_id uuid)
 RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _fim date;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alinhar planos';
  END IF;
  SELECT c.data_fim INTO _fim FROM public.contratos c
  WHERE c.plano_id = p_plano_id AND c.status = 'ativo'
  ORDER BY c.created_at DESC LIMIT 1;
  IF _fim IS NULL THEN
    RAISE EXCEPTION 'Nenhum contrato ativo com data final para este plano';
  END IF;
  UPDATE public.planos
  SET proxima_renovacao = CASE WHEN renovacao_automatica THEN _fim ELSE proxima_renovacao END,
      data_fim = CASE WHEN renovacao_automatica THEN data_fim ELSE _fim END,
      updated_at = now()
  WHERE id = p_plano_id;
  RETURN _fim;
END;
$$;