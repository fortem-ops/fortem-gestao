CREATE OR REPLACE FUNCTION public.fn_tarefa_onda_531_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _treino record;
  _semana int;
  _ordem int;
  _aluno_nome text;
  _resp uuid;
BEGIN
  -- Só age quando a sessão passa a ter concluido_em preenchido
  IF NEW.treino_id IS NULL OR NEW.concluido_em IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.concluido_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, aluno_id, template_fase, conteudo
    INTO _treino
    FROM public.treinos
   WHERE id = NEW.treino_id;

  IF _treino.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mesmo critério do portal: template_fase = '5-3-1' ou conteudo.variante = '531'
  IF COALESCE(_treino.template_fase, '') <> '5-3-1'
     AND COALESCE(_treino.conteudo ->> 'variante', '') <> '531' THEN
    RETURN NEW;
  END IF;

  -- Onda concluída = toda combinação semana 1..4 x ordem de dia com sessão concluída
  FOR _semana IN 1..4 LOOP
    FOR _ordem IN
      SELECT (d ->> 'ordem')::int
        FROM jsonb_array_elements(COALESCE(_treino.conteudo -> 'dias', '[]'::jsonb)) AS d
    LOOP
      IF NOT EXISTS (
        SELECT 1
          FROM public.treino_sessoes ts
         WHERE ts.treino_id = NEW.treino_id
           AND ts.variacao = 'S' || _semana || '-T' || _ordem
           AND ts.concluido_em IS NOT NULL
      ) THEN
        RETURN NEW;
      END IF;
    END LOOP;
  END LOOP;

  -- Idempotente: não cria se já existe tarefa (pendente ou concluída) deste tipo para este treino
  IF EXISTS (
    SELECT 1
      FROM public.tarefas t
     WHERE t.tipo_auto = 'treino_onda_concluida'
       AND t.descricao LIKE '%treino_id:' || NEW.treino_id::text || '%'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT nome, responsavel_id INTO _aluno_nome, _resp
    FROM public.alunos
   WHERE id = NEW.aluno_id;

  -- Mesmo padrão das demais triggers de tarefa automática: sem responsável, não cria
  IF _resp IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tarefas (
    titulo, descricao, aluno_id, responsavel_id, criado_por_id,
    prioridade, status, data_limite, automatica, tipo_auto
  ) VALUES (
    'Alterar treino: onda 5-3-1 concluída',
    COALESCE(_aluno_nome, 'O aluno') || ' concluiu as 4 semanas do 5-3-1. Defina a próxima onda ou outro método. treino_id:' || NEW.treino_id::text,
    NEW.aluno_id, _resp, _resp,
    'media', 'pendente', CURRENT_DATE + INTERVAL '3 days', true, 'treino_onda_concluida'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebrar a conclusão do treino por causa da tarefa
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_onda_531_concluida ON public.treino_sessoes;
CREATE TRIGGER trg_tarefa_onda_531_concluida
AFTER INSERT OR UPDATE OF concluido_em ON public.treino_sessoes
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_onda_531_concluida();