-- Resolver profissional correto para comissão de Avaliação Funcional
CREATE OR REPLACE FUNCTION public.fn_resolver_prof_avaliacao(_aluno_id uuid, _data date, _avaliador uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _prof uuid;
BEGIN
  -- 1) Agendamento mais recente de Avaliação Funcional para o aluno
  SELECT profissional_id INTO _prof
  FROM public.agenda_servicos
  WHERE aluno_id = _aluno_id
    AND (atividade ILIKE '%funcional%')
    AND COALESCE(data_especifica, _data) <= _data
  ORDER BY COALESCE(data_especifica, _data) DESC, created_at DESC
  LIMIT 1;

  IF _prof IS NOT NULL AND NOT public.has_role(_prof, 'admin') THEN
    RETURN _prof;
  END IF;

  -- 2) Responsável da carteira do aluno
  SELECT responsavel_id INTO _prof FROM public.alunos WHERE id = _aluno_id;
  IF _prof IS NOT NULL AND NOT public.has_role(_prof, 'admin') THEN
    RETURN _prof;
  END IF;

  -- 3) Avaliador, se não for admin
  IF _avaliador IS NOT NULL AND NOT public.has_role(_avaliador, 'admin') THEN
    RETURN _avaliador;
  END IF;

  RETURN NULL;
END $$;

-- Substituir trigger de avaliação (insert)
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _permite_upload boolean := false;
  _aluno_nome text;
  _agenda_id uuid;
  _profissional uuid;
BEGIN
  IF NEW.tipo NOT IN ('funcional','forca') THEN RETURN NEW; END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  IF NEW.protocolo_id IS NOT NULL THEN
    SELECT permite_upload INTO _permite_upload FROM public.avaliacao_protocolos WHERE id = NEW.protocolo_id;
  END IF;

  -- pendência aberta
  UPDATE public.comissionamento_pendencias
  SET concluido = true, concluido_em = now(), responsavel_id = NEW.avaliador_id, avaliacao_id = NEW.id
  WHERE id = (
    SELECT id FROM public.comissionamento_pendencias
    WHERE aluno_id = NEW.aluno_id AND tipo_pendencia = 'concluir_avaliacao_funcional' AND concluido = false
    ORDER BY created_at DESC LIMIT 1
  )
  RETURNING agenda_id, profissional_id INTO _agenda_id, _profissional;

  -- se nulo ou admin, resolver pela cadeia
  IF _profissional IS NULL OR public.has_role(_profissional, 'admin') THEN
    _profissional := public.fn_resolver_prof_avaliacao(NEW.aluno_id, NEW.data, NEW.avaliador_id);
  END IF;

  IF _profissional IS NULL THEN
    -- pendência órfã para revisão manual
    INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (COALESCE(NEW.avaliador_id, NEW.aluno_id), NEW.aluno_id, 'concluir_avaliacao_funcional',
      'Sem profissional vinculado — revisar atribuição', NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF COALESCE(_permite_upload, false) THEN
    INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (_profissional, NEW.aluno_id, 'upload_arquivo_forca',
      'Upload de arquivo da avaliação de ' || COALESCE(_aluno_nome,''), NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM public.fn_gerar_comissao(
      'avaliacao_funcional', _profissional, NEW.aluno_id, 'avaliacoes', NEW.id,
      'Avaliação funcional concluída'
    );
  END IF;

  RETURN NEW;
END $$;

-- Trigger de anexo
CREATE OR REPLACE FUNCTION public.trg_comissao_anexo_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _aluno uuid;
  _data date;
  _avaliador uuid;
  _profissional uuid;
  _pend record;
BEGIN
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
END $$;

-- Backfill: reatribuir comissões de avaliacao_funcional cujo profissional é admin
DO $$
DECLARE
  _r record;
  _novo uuid;
  _data date;
  _avaliador uuid;
BEGIN
  FOR _r IN
    SELECT c.id, c.aluno_id, c.origem_id
    FROM public.comissionamentos c
    WHERE c.tipo = 'avaliacao_funcional'
      AND public.has_role(c.profissional_id, 'admin')
      AND c.status IN ('pendente','aprovado')
  LOOP
    SELECT data, avaliador_id INTO _data, _avaliador
    FROM public.avaliacoes WHERE id = _r.origem_id;

    _novo := public.fn_resolver_prof_avaliacao(_r.aluno_id, COALESCE(_data, CURRENT_DATE), _avaliador);

    IF _novo IS NOT NULL THEN
      UPDATE public.comissionamentos
      SET profissional_id = _novo,
          observacoes = COALESCE(observacoes,'') || ' [Reatribuído automaticamente do admin]'
      WHERE id = _r.id;
    ELSE
      UPDATE public.comissionamentos
      SET status = 'cancelado',
          observacoes = COALESCE(observacoes,'') || ' [Cancelado: sem profissional vinculado]'
      WHERE id = _r.id;
    END IF;
  END LOOP;
END $$;