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

  -- Para v2 parcial: atualiza somente a descrição da pendência aberta, sem marcá-la concluída.
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
    INSERT INTO public.comissionamento_pendencias
      (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (COALESCE(NEW.avaliador_id, NEW.aluno_id), NEW.aluno_id,
      'concluir_avaliacao_funcional',
      'Sem profissional vinculado — revisar atribuição', NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
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
    INSERT INTO public.comissionamento_pendencias
      (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (_profissional, NEW.aluno_id, 'upload_arquivo_forca',
      'Upload de arquivo da avaliação de ' || COALESCE(_aluno_nome,''), NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM public.fn_gerar_comissao(
      'avaliacao_funcional', _profissional, NEW.aluno_id,
      'avaliacoes', NEW.id, 'Avaliação funcional concluída'
    );
  END IF;

  RETURN NEW;
END $function$;

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

  -- Se continua parcial após o update: só ajusta a descrição da pendência aberta.
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

  -- Transição parcial → completo: fecha a pendência aberta.
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
END $function$;