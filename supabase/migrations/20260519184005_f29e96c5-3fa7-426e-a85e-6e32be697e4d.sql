
-- Helper: resolve responsável for reavaliação (responsavel_id; fallback to fallback_user_id; null if admin)
CREATE OR REPLACE FUNCTION public.fn_resolver_responsavel_reavaliacao(_aluno_id uuid, _fallback uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp uuid;
BEGIN
  SELECT responsavel_id INTO _resp FROM public.alunos WHERE id = _aluno_id;
  IF _resp IS NOT NULL AND NOT public.has_role(_resp, 'admin'::app_role) THEN
    RETURN _resp;
  END IF;
  IF _fallback IS NOT NULL AND NOT public.has_role(_fallback, 'admin'::app_role) THEN
    RETURN _fallback;
  END IF;
  RETURN NULL;
END;
$$;

-- Core: cria tarefa idempotente de reavaliação para o aluno
CREATE OR REPLACE FUNCTION public.fn_criar_tarefa_reavaliacao(
  _aluno_id uuid,
  _data_ultima date,
  _criado_por uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _responsavel uuid;
  _criador uuid;
  _aluno_nome text;
  _existente uuid;
  _nova_id uuid;
  _data_limite date;
BEGIN
  _responsavel := public.fn_resolver_responsavel_reavaliacao(_aluno_id, _criado_por);
  IF _responsavel IS NULL THEN
    RETURN NULL;
  END IF;

  -- idempotência: já existe uma pendente?
  SELECT id INTO _existente
  FROM public.tarefas
  WHERE aluno_id = _aluno_id
    AND tipo_auto = 'reavaliacao_funcional'
    AND status = 'pendente'
  LIMIT 1;

  IF _existente IS NOT NULL THEN
    RETURN _existente;
  END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = _aluno_id;
  _criador := COALESCE(_criado_por, _responsavel);
  _data_limite := COALESCE(_data_ultima, CURRENT_DATE) + INTERVAL '4 months';

  INSERT INTO public.tarefas (
    titulo, descricao, aluno_id, responsavel_id, criado_por_id,
    prioridade, status, data_limite, automatica, tipo_auto
  ) VALUES (
    'Agendar reavaliação funcional',
    CASE
      WHEN _data_ultima IS NULL THEN
        'Aluno ' || COALESCE(_aluno_nome, '') || ' sem avaliação funcional registrada. Agende uma nova avaliação.'
      ELSE
        'Última avaliação funcional realizada em ' || to_char(_data_ultima, 'DD/MM/YYYY') || '. Agende uma nova avaliação.'
    END,
    _aluno_id, _responsavel, _criador,
    'media', 'pendente', _data_limite, true, 'reavaliacao_funcional'
  )
  RETURNING id INTO _nova_id;

  RETURN _nova_id;
END;
$$;

-- Trigger 1: ao inserir avaliação funcional, agenda tarefa com data_limite = data + 4 meses
CREATE OR REPLACE FUNCTION public.trg_aval_reavaliacao_4m()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS NOT NULL AND lower(NEW.tipo) LIKE '%funcional%' THEN
    PERFORM public.fn_criar_tarefa_reavaliacao(NEW.aluno_id, NEW.data, NEW.avaliador_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacao_reavaliacao_4m ON public.avaliacoes;
CREATE TRIGGER trg_avaliacao_reavaliacao_4m
AFTER INSERT ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_aval_reavaliacao_4m();

-- Trigger 2: ao concluir pendência 'concluir_avaliacao_funcional', agenda tarefa
CREATE OR REPLACE FUNCTION public.trg_pendencia_reavaliacao_4m()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _data date;
BEGIN
  IF NEW.tipo_pendencia::text = 'concluir_avaliacao_funcional'
     AND NEW.concluido = true
     AND COALESCE(OLD.concluido, false) = false
     AND NEW.aluno_id IS NOT NULL THEN
    SELECT COALESCE(data_especifica, CURRENT_DATE) INTO _data
    FROM public.agenda_servicos WHERE id = NEW.agenda_id;
    PERFORM public.fn_criar_tarefa_reavaliacao(NEW.aluno_id, COALESCE(_data, CURRENT_DATE), NEW.profissional_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pendencia_reavaliacao_4m ON public.comissionamento_pendencias;
CREATE TRIGGER trg_pendencia_reavaliacao_4m
AFTER UPDATE ON public.comissionamento_pendencias
FOR EACH ROW EXECUTE FUNCTION public.trg_pendencia_reavaliacao_4m();

-- Função para job diário: varre alunos ativos sem reavaliação em 4m
CREATE OR REPLACE FUNCTION public.fn_agendar_reavaliacoes_pendentes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno record;
  _last_data date;
  _criadas integer := 0;
BEGIN
  FOR _aluno IN
    SELECT id, responsavel_id FROM public.alunos WHERE status = 'ativo'
  LOOP
    -- maior entre avaliações funcionais e agendamentos passados
    SELECT MAX(d) INTO _last_data FROM (
      SELECT data AS d FROM public.avaliacoes
        WHERE aluno_id = _aluno.id AND lower(tipo) LIKE '%funcional%'
      UNION ALL
      SELECT data_especifica AS d FROM public.agenda_servicos
        WHERE aluno_id = _aluno.id
          AND atividade ILIKE '%funcional%'
          AND data_especifica IS NOT NULL
          AND data_especifica <= CURRENT_DATE
    ) x;

    IF _last_data IS NULL OR CURRENT_DATE >= _last_data + INTERVAL '4 months' THEN
      IF public.fn_criar_tarefa_reavaliacao(_aluno.id, _last_data, _aluno.responsavel_id) IS NOT NULL THEN
        _criadas := _criadas + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('tarefas_criadas', _criadas, 'executado_em', now());
END;
$$;
