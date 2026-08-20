-- 1) Desativa a regra de comissão de avaliação funcional
UPDATE public.comissionamento_config SET ativo = false WHERE tipo = 'avaliacao_funcional';

-- 2) Helper: processo de avaliação funcional está ativo?
CREATE OR REPLACE FUNCTION public.fn_comissao_af_ativa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT ativo FROM public.comissionamento_config WHERE tipo = 'avaliacao_funcional'), false);
$$;

-- 3) Agenda: não cria mais pendência de avaliação funcional (experimental segue)
CREATE OR REPLACE FUNCTION public.trg_comissao_agenda_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_nome text;
BEGIN
  IF NEW.aluno_id IS NULL OR NEW.profissional_id IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  IF NEW.atividade ILIKE 'Treino Experimental' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comissionamento_pendencias
      WHERE profissional_id = NEW.profissional_id
        AND aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'avaliar_experimental'
        AND COALESCE(agenda_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, agenda_id)
      VALUES (NEW.profissional_id, NEW.aluno_id, 'avaliar_experimental',
        'Concluir avaliação do Treino Experimental de ' || COALESCE(_aluno_nome,''), NEW.id);
    END IF;
  ELSIF NEW.atividade ILIKE 'Avaliação Funcional' AND public.fn_comissao_af_ativa() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comissionamento_pendencias
      WHERE profissional_id = NEW.profissional_id
        AND aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'concluir_avaliacao_funcional'
        AND COALESCE(agenda_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, agenda_id)
      VALUES (NEW.profissional_id, NEW.aluno_id, 'concluir_avaliacao_funcional',
        'Concluir avaliação funcional de ' || COALESCE(_aluno_nome,''), NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

-- 4) Avaliações (insert)
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _permite_upload boolean := false;
  _aluno_nome text;
  _agenda_id uuid;
  _profissional uuid;
  _is_v2 boolean := (NEW.tipo = 'funcional_v2');
  _tem_metricas boolean := false;
  _tem_forca boolean := false;
  _v2_completo boolean := false;
  _descricao_parcial text;
BEGIN
  IF NOT public.fn_comissao_af_ativa() THEN RETURN NEW; END IF;

  IF NEW.tipo NOT IN ('funcional','forca','funcional_v2') THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  IF _is_v2 THEN
    _tem_metricas := jsonb_typeof(NEW.dados->'metricas') = 'array'
                     AND jsonb_array_length(NEW.dados->'metricas') > 0;
    _tem_forca    := jsonb_typeof(NEW.dados->'forca'->'exercicios') = 'array'
                     AND jsonb_array_length(NEW.dados->'forca'->'exercicios') > 0;
    _v2_completo  := _tem_metricas AND _tem_forca;
    IF NOT _v2_completo THEN
      IF _tem_forca AND NOT _tem_metricas THEN
        _descricao_parcial := 'Mobilidade/flexibilidade pendente — ' || COALESCE(_aluno_nome,'');
      ELSIF _tem_metricas AND NOT _tem_forca THEN
        _descricao_parcial := 'Força pendente — ' || COALESCE(_aluno_nome,'');
      END IF;
    END IF;
  ELSE
    IF NEW.protocolo_id IS NOT NULL THEN
      SELECT permite_upload INTO _permite_upload
      FROM public.avaliacao_protocolos WHERE id = NEW.protocolo_id;
    END IF;
  END IF;

  IF _is_v2 AND NOT _v2_completo THEN
    UPDATE public.comissionamento_pendencias
    SET descricao = COALESCE(_descricao_parcial, descricao),
        avaliacao_id = NEW.id
    WHERE id = (
      SELECT id FROM public.comissionamento_pendencias
      WHERE aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'concluir_avaliacao_funcional'
        AND concluido = false
      ORDER BY created_at DESC LIMIT 1
    )
    RETURNING agenda_id, profissional_id INTO _agenda_id, _profissional;
    RETURN NEW;
  END IF;

  UPDATE public.comissionamento_pendencias
  SET concluido = true, concluido_em = now(),
      responsavel_id = NEW.avaliador_id, avaliacao_id = NEW.id
  WHERE id = (
    SELECT id FROM public.comissionamento_pendencias
    WHERE aluno_id = NEW.aluno_id
      AND tipo_pendencia = 'concluir_avaliacao_funcional'
      AND concluido = false
    ORDER BY created_at DESC LIMIT 1
  )
  RETURNING agenda_id, profissional_id INTO _agenda_id, _profissional;

  IF _profissional IS NULL OR public.has_role(_profissional, 'admin') THEN
    _profissional := public.fn_resolver_prof_avaliacao(NEW.aluno_id, NEW.data, NEW.avaliador_id);
  END IF;

  IF _profissional IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comissionamento_pendencias
      WHERE aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'concluir_avaliacao_funcional'
        AND COALESCE(avaliacao_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      INSERT INTO public.comissionamento_pendencias
        (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
      VALUES (COALESCE(NEW.avaliador_id, NEW.aluno_id), NEW.aluno_id,
        'concluir_avaliacao_funcional',
        'Sem profissional vinculado — revisar atribuição', NEW.id, _agenda_id);
    END IF;
    RETURN NEW;
  END IF;

  IF _is_v2 THEN
    IF _v2_completo THEN
      PERFORM public.fn_gerar_comissao(
        'avaliacao_funcional', _profissional, NEW.aluno_id,
        'avaliacoes', NEW.id, 'Avaliação funcional v2 concluída'
      );
    END IF;
  ELSIF COALESCE(_permite_upload, false) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comissionamento_pendencias
      WHERE profissional_id = _profissional
        AND aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'upload_arquivo_forca'
        AND COALESCE(avaliacao_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      INSERT INTO public.comissionamento_pendencias
        (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
      VALUES (_profissional, NEW.aluno_id, 'upload_arquivo_forca',
        'Upload de arquivo da avaliação de ' || COALESCE(_aluno_nome,''), NEW.id, _agenda_id);
    END IF;
  ELSE
    PERFORM public.fn_gerar_comissao(
      'avaliacao_funcional', _profissional, NEW.aluno_id,
      'avaliacoes', NEW.id, 'Avaliação funcional concluída'
    );
  END IF;

  RETURN NEW;
END
$function$;

-- 5) Avaliações v2 (update)
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_v2_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old_completo boolean;
  _new_completo boolean;
  _tem_metricas boolean;
  _tem_forca boolean;
  _profissional uuid;
  _ja_existe boolean;
  _aluno_nome text;
  _descricao_parcial text;
BEGIN
  IF NOT public.fn_comissao_af_ativa() THEN RETURN NEW; END IF;
  IF NEW.tipo <> 'funcional_v2' THEN RETURN NEW; END IF;

  _tem_metricas := jsonb_typeof(NEW.dados->'metricas') = 'array'
                   AND jsonb_array_length(NEW.dados->'metricas') > 0;
  _tem_forca    := jsonb_typeof(NEW.dados->'forca'->'exercicios') = 'array'
                   AND jsonb_array_length(NEW.dados->'forca'->'exercicios') > 0;

  _old_completo :=
       jsonb_typeof(OLD.dados->'metricas') = 'array'
       AND jsonb_array_length(OLD.dados->'metricas') > 0
       AND jsonb_typeof(OLD.dados->'forca'->'exercicios') = 'array'
       AND jsonb_array_length(OLD.dados->'forca'->'exercicios') > 0;

  _new_completo := _tem_metricas AND _tem_forca;

  IF NOT _new_completo THEN
    SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;
    IF _tem_forca AND NOT _tem_metricas THEN
      _descricao_parcial := 'Mobilidade/flexibilidade pendente — ' || COALESCE(_aluno_nome,'');
    ELSIF _tem_metricas AND NOT _tem_forca THEN
      _descricao_parcial := 'Força pendente — ' || COALESCE(_aluno_nome,'');
    END IF;
    IF _descricao_parcial IS NOT NULL THEN
      UPDATE public.comissionamento_pendencias
      SET descricao = _descricao_parcial, avaliacao_id = NEW.id
      WHERE aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'concluir_avaliacao_funcional'
        AND concluido = false;
    END IF;
    RETURN NEW;
  END IF;

  IF _old_completo THEN
    RETURN NEW;
  END IF;

  UPDATE public.comissionamento_pendencias
  SET concluido = true, concluido_em = now(),
      responsavel_id = COALESCE(NEW.avaliador_id, responsavel_id),
      avaliacao_id = NEW.id
  WHERE aluno_id = NEW.aluno_id
    AND tipo_pendencia = 'concluir_avaliacao_funcional'
    AND concluido = false;

  SELECT EXISTS (
    SELECT 1 FROM public.comissionamentos
    WHERE origem_tabela = 'avaliacoes' AND origem_id = NEW.id
      AND tipo = 'avaliacao_funcional'
  ) INTO _ja_existe;
  IF _ja_existe THEN RETURN NEW; END IF;

  _profissional := public.fn_resolver_prof_avaliacao(NEW.aluno_id, NEW.data, NEW.avaliador_id);
  IF _profissional IS NULL THEN RETURN NEW; END IF;

  PERFORM public.fn_gerar_comissao(
    'avaliacao_funcional', _profissional, NEW.aluno_id,
    'avaliacoes', NEW.id, 'Avaliação funcional v2 completada em update'
  );
  RETURN NEW;
END
$function$;

-- 6) Anexo de laudo
CREATE OR REPLACE FUNCTION public.trg_comissao_anexo_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _aluno uuid;
  _data date;
  _avaliador uuid;
  _profissional uuid;
  _pend record;
BEGIN
  IF NOT public.fn_comissao_af_ativa() THEN RETURN NEW; END IF;

  SELECT aluno_id, data, avaliador_id INTO _aluno, _data, _avaliador
  FROM public.avaliacoes WHERE id = NEW.avaliacao_id;

  SELECT * INTO _pend FROM public.comissionamento_pendencias
  WHERE avaliacao_id = NEW.avaliacao_id AND tipo_pendencia = 'upload_arquivo_forca' AND concluido = false
  LIMIT 1;

  IF _pend.id IS NOT NULL THEN
    UPDATE public.comissionamento_pendencias
    SET concluido = true, concluido_em = now(), responsavel_id = NEW.uploaded_by
    WHERE id = _pend.id;

    _profissional := _pend.profissional_id;
    IF _profissional IS NULL OR public.has_role(_profissional, 'admin') THEN
      _profissional := public.fn_resolver_prof_avaliacao(_aluno, _data, _avaliador);
    END IF;

    IF _profissional IS NOT NULL THEN
      PERFORM public.fn_gerar_comissao(
        'avaliacao_funcional', _profissional, _aluno, 'avaliacoes', NEW.avaliacao_id,
        'Avaliação funcional + upload concluído'
      );
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

-- 7) Tarefa de reavaliação disparada ao concluir pendência
CREATE OR REPLACE FUNCTION public.trg_pendencia_reavaliacao_4m()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _data date;
BEGIN
  IF NOT public.fn_comissao_af_ativa() THEN RETURN NEW; END IF;

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
$function$;

-- 8) Rotina diária de reavaliações: pausada
CREATE OR REPLACE FUNCTION public.fn_agendar_reavaliacoes_pendentes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _aluno record;
  _last_data date;
  _criadas integer := 0;
BEGIN
  IF NOT public.fn_comissao_af_ativa() THEN
    RETURN jsonb_build_object('pausado', true, 'tarefas_criadas', 0, 'executado_em', now());
  END IF;

  FOR _aluno IN
    SELECT id, responsavel_id FROM public.alunos WHERE status = 'ativo'
  LOOP
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
$function$;