-- Geração automática de tarefas de Relatório Técnico (Força mensal / Corrida quinzenal)
CREATE OR REPLACE FUNCTION public.fn_gerar_tarefas_relatorio_tecnico(_data date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia int := EXTRACT(DAY FROM _data)::int;
  v_yasmim uuid;
  v_sistema uuid;
  v_criadas int := 0;
  v_n int;
BEGIN
  IF v_dia NOT IN (1, 15) THEN
    RETURN 0;
  END IF;

  SELECT user_id INTO v_yasmim FROM public.profiles
   WHERE full_name ILIKE 'Yasmim%' ORDER BY full_name LIMIT 1;

  SELECT user_id INTO v_sistema FROM public.user_roles WHERE role = 'admin' LIMIT 1;

  -- Força: apenas no dia 1, para todos os alunos ativos
  IF v_dia = 1 THEN
    INSERT INTO public.tarefas
      (titulo, descricao, aluno_id, responsavel_id, criado_por_id, prioridade, status,
       data_limite, automatica, tipo_auto, tipo_atividade, origem)
    SELECT
      'Relatório Técnico — Treinos de Força: ' || a.nome,
      'Preencha o Relatório Técnico (Treinos de força) do aluno referente ao ciclo de ' || to_char(_data, 'MM/YYYY') || '.',
      a.id,
      COALESCE(a.responsavel_id, v_sistema),
      v_sistema,
      'media',
      'pendente',
      _data,
      true,
      'relatorio_tecnico_forca',
      'tarefa',
      'tecnico'
    FROM public.alunos a
    WHERE a.status = 'ativo'
      AND COALESCE(a.responsavel_id, v_sistema) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tarefas t
        WHERE t.aluno_id = a.id
          AND t.tipo_auto = 'relatorio_tecnico_forca'
          AND t.data_limite = _data
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.avaliacoes av
        WHERE av.aluno_id = a.id
          AND av.tipo = 'relatorioforca'
          AND av.protocolo_id = '4b6b7a67-6b4b-424d-baf0-905d6548ffd7'::uuid
          AND av.data >= _data
          AND av.dados->>'status' = 'finalizado'
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_criadas := v_criadas + v_n;
  END IF;

  -- Corrida: dias 1 e 15, apenas alunos com plano de corrida ativo, responsável Yasmim
  INSERT INTO public.tarefas
    (titulo, descricao, aluno_id, responsavel_id, criado_por_id, prioridade, status,
     data_limite, automatica, tipo_auto, tipo_atividade, origem)
  SELECT DISTINCT ON (a.id)
    'Relatório Técnico — Treinos de Corrida: ' || a.nome,
    'Preencha o Relatório Técnico (Treinos de corrida) do aluno referente ao ciclo de ' || to_char(_data, 'DD/MM/YYYY') || '.',
    a.id,
    COALESCE(v_yasmim, a.responsavel_id, v_sistema),
    v_sistema,
    'media',
    'pendente',
    _data,
    true,
    'relatorio_tecnico_corrida',
    'tarefa',
    'tecnico'
  FROM public.alunos a
  JOIN public.planos p ON p.aluno_id = a.id AND p.ativo AND p.atividade = 'corrida'
  WHERE a.status = 'ativo'
    AND COALESCE(v_yasmim, a.responsavel_id, v_sistema) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.aluno_id = a.id
        AND t.tipo_auto = 'relatorio_tecnico_corrida'
        AND t.data_limite = _data
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.avaliacoes av
      WHERE av.aluno_id = a.id
        AND av.tipo = 'relatorioforca'
        AND av.protocolo_id = '15007760-bc0c-4ff2-a48c-7d731f23b634'::uuid
        AND av.data >= _data
        AND av.dados->>'status' = 'finalizado'
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_criadas := v_criadas + v_n;

  RETURN v_criadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_gerar_tarefas_relatorio_tecnico(date) TO authenticated, service_role;

-- Conclui a tarefa do ciclo quando o relatório técnico é finalizado
CREATE OR REPLACE FUNCTION public.fn_relatorio_tecnico_concluir_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_auto text;
BEGIN
  IF NEW.tipo <> 'relatorioforca' OR COALESCE(NEW.dados->>'status', '') <> 'finalizado' THEN
    RETURN NEW;
  END IF;

  v_tipo_auto := CASE NEW.protocolo_id
    WHEN '4b6b7a67-6b4b-424d-baf0-905d6548ffd7'::uuid THEN 'relatorio_tecnico_forca'
    WHEN '15007760-bc0c-4ff2-a48c-7d731f23b634'::uuid THEN 'relatorio_tecnico_corrida'
    ELSE NULL
  END;

  IF v_tipo_auto IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.tarefas
     SET status = 'concluida', updated_at = now()
   WHERE aluno_id = NEW.aluno_id
     AND tipo_auto = v_tipo_auto
     AND status <> 'concluida'
     AND data_limite <= NEW.data;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relatorio_tecnico_concluir_tarefa ON public.avaliacoes;
CREATE TRIGGER trg_relatorio_tecnico_concluir_tarefa
AFTER INSERT OR UPDATE OF dados, protocolo_id, data ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_relatorio_tecnico_concluir_tarefa();