-- 1) Listagem de divergências entre plano e contrato ativo
CREATE OR REPLACE FUNCTION public.fn_planos_divergencia_contrato()
RETURNS TABLE (
  plano_id uuid,
  aluno_id uuid,
  aluno_nome text,
  tipo text,
  plano_data_fim date,
  contrato_id uuid,
  contrato_data_fim date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.aluno_id,
         a.nome,
         p.tipo,
         p.data_fim,
         c.id,
         c.data_fim
  FROM public.planos p
  JOIN public.contratos c
    ON c.plano_id = p.id AND c.status = 'ativo'
  JOIN public.alunos a ON a.id = p.aluno_id
  WHERE p.ativo
    AND p.atividade = 'treinamento_funcional'
    AND coalesce(p.data_fim, DATE '2100-01-01') <> coalesce(c.data_fim, DATE '2100-01-01')
    AND public.is_coordinator_or_admin(auth.uid())
  ORDER BY a.nome;
$$;

REVOKE ALL ON FUNCTION public.fn_planos_divergencia_contrato() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_planos_divergencia_contrato() TO authenticated;

-- 2) Alinhar a data final do plano à do contrato ativo
CREATE OR REPLACE FUNCTION public.fn_alinhar_plano_ao_contrato(p_plano_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fim date;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alinhar planos';
  END IF;

  SELECT c.data_fim INTO _fim
  FROM public.contratos c
  WHERE c.plano_id = p_plano_id AND c.status = 'ativo'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF _fim IS NULL THEN
    RAISE EXCEPTION 'Nenhum contrato ativo com data final para este plano';
  END IF;

  UPDATE public.planos
  SET data_fim = _fim, updated_at = now()
  WHERE id = p_plano_id;

  RETURN _fim;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_alinhar_plano_ao_contrato(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_alinhar_plano_ao_contrato(uuid) TO authenticated;

-- 3) Rotina diária: alerta interno quando houver divergências
CREATE OR REPLACE FUNCTION public.fn_planos_divergencia_alertar()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _linhas text;
  _qtd integer;
  _autor uuid;
  _notif uuid;
BEGIN
  SELECT count(*),
         string_agg(
           a.nome || ' — plano até ' || to_char(p.data_fim, 'DD/MM/YYYY') ||
           ', contrato até ' || to_char(c.data_fim, 'DD/MM/YYYY'),
           E'\n' ORDER BY a.nome
         )
  INTO _qtd, _linhas
  FROM public.planos p
  JOIN public.contratos c ON c.plano_id = p.id AND c.status = 'ativo'
  JOIN public.alunos a ON a.id = p.aluno_id
  WHERE p.ativo
    AND p.atividade = 'treinamento_funcional'
    AND coalesce(p.data_fim, DATE '2100-01-01') <> coalesce(c.data_fim, DATE '2100-01-01');

  IF coalesce(_qtd, 0) = 0 THEN
    RETURN 0;
  END IF;

  SELECT ur.user_id INTO _autor
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.user_id
  LIMIT 1;

  IF _autor IS NULL THEN
    RETURN _qtd;
  END IF;

  INSERT INTO public.notificacoes (titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (
    'Divergência entre plano e contrato (' || _qtd || ')',
    'Planos ativos com data final diferente do contrato ativo:' || E'\n' || _linhas ||
    E'\n\nCorrija em Relatórios > Planos.',
    'administrativo', 'alta', 'solicitacao', _autor
  )
  RETURNING id INTO _notif;

  INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT _notif, ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'coordenador') AND ur.user_id <> _autor
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;

  RETURN _qtd;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_planos_divergencia_alertar() FROM PUBLIC, anon, authenticated;