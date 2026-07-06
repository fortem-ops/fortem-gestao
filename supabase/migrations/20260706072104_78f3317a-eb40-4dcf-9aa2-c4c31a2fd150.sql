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
  ELSE
    IF NEW.protocolo_id IS NOT NULL THEN
      SELECT permite_upload INTO _permite_upload
      FROM public.avaliacao_protocolos WHERE id = NEW.protocolo_id;
    END IF;
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
    IF _tem_metricas AND _tem_forca THEN
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
  _profissional uuid;
  _ja_existe boolean;
BEGIN
  IF NEW.tipo <> 'funcional_v2' THEN RETURN NEW; END IF;

  _old_completo :=
       jsonb_typeof(OLD.dados->'metricas') = 'array'
       AND jsonb_array_length(OLD.dados->'metricas') > 0
       AND jsonb_typeof(OLD.dados->'forca'->'exercicios') = 'array'
       AND jsonb_array_length(OLD.dados->'forca'->'exercicios') > 0;

  _new_completo :=
       jsonb_typeof(NEW.dados->'metricas') = 'array'
       AND jsonb_array_length(NEW.dados->'metricas') > 0
       AND jsonb_typeof(NEW.dados->'forca'->'exercicios') = 'array'
       AND jsonb_array_length(NEW.dados->'forca'->'exercicios') > 0;

  IF _old_completo OR NOT _new_completo THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS trg_comissao_avaliacao_v2_update ON public.avaliacoes;
CREATE TRIGGER trg_comissao_avaliacao_v2_update
AFTER UPDATE OF dados ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_avaliacao_v2_update();