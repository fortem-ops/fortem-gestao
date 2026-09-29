CREATE OR REPLACE FUNCTION public.fn_planos_divergencia_contrato()
 RETURNS TABLE(plano_id uuid, aluno_id uuid, aluno_nome text, tipo text, plano_data_fim date, contrato_id uuid, contrato_data_fim date, motivo text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM (
    SELECT p.id, p.aluno_id, a.nome, p.tipo,
           CASE WHEN p.data_fim IS NULL AND p.renovacao_automatica THEN p.proxima_renovacao ELSE p.data_fim END AS pfim,
           c.id AS cid, c.data_fim AS cfim,
           CASE WHEN p.data_fim IS NOT NULL THEN 'data_fim_diferente'
                WHEN p.renovacao_automatica THEN 'renovacao_diferente'
                ELSE 'plano_sem_fim' END AS motivo
    FROM public.planos p
    JOIN public.contratos c ON c.plano_id = p.id AND c.status = 'ativo'
    JOIN public.alunos a ON a.id = p.aluno_id
    WHERE p.ativo AND p.atividade = 'treinamento_funcional'
      AND public.is_coordinator_or_admin(auth.uid())
  ) x
  WHERE CASE x.motivo
          WHEN 'plano_sem_fim' THEN true
          ELSE x.pfim IS DISTINCT FROM x.cfim END
  ORDER BY x.nome;
$$;

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
  SET proxima_renovacao = CASE WHEN data_fim IS NULL AND renovacao_automatica THEN _fim ELSE proxima_renovacao END,
      data_fim = CASE WHEN data_fim IS NULL AND renovacao_automatica THEN NULL ELSE _fim END,
      updated_at = now()
  WHERE id = p_plano_id;
  RETURN _fim;
END;
$$;