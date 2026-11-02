CREATE OR REPLACE FUNCTION public.fn_comunidade_compartilhar(p_tipo text, p_referencia_id uuid, p_audiencia text DEFAULT 'clubes', p_foto_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _eu uuid := public.fn_comunidade_meu_aluno();
  _payload jsonb; _ref_tipo text; _id uuid; _codigo text; _nome text;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno' USING ERRCODE = '42501'; END IF;
  IF NOT public.fn_comunidade_feed_pode_publicar(_eu) THEN RAISE EXCEPTION 'sem_consentimento' USING ERRCODE = '42501'; END IF;
  IF p_audiencia NOT IN ('fortem','clubes') THEN RAISE EXCEPTION 'audiencia_invalida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('comunidade_feed:' || _eu::text));
  IF (SELECT count(*) FROM public.comunidade_feed_posts
      WHERE aluno_id = _eu AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = _hoje) >= 3 THEN
    RAISE EXCEPTION 'limite_diario';
  END IF;

  IF p_tipo = 'treino' THEN
    _ref_tipo := 'treino';
    SELECT jsonb_strip_nulls(jsonb_build_object(
             'modalidade', CASE WHEN ts.modalidade = 'corrida' THEN 'Corrida' ELSE 'Funcional' END,
             'data', ta.data, 'horario', to_char(ta.horario_inicio, 'HH24:MI'),
             'duracao_min', CASE WHEN ta.horario_fim > ta.horario_inicio
                                 THEN (extract(epoch FROM ta.horario_fim - ta.horario_inicio) / 60)::int END))
      INTO _payload
      FROM public.treino_agendamentos ta LEFT JOIN public.treino_slots ts ON ts.id = ta.slot_id
      WHERE ta.id = p_referencia_id AND ta.aluno_id = _eu AND ta.status = 'realizado';
  ELSIF p_tipo IN ('conquista','sequencia') THEN
    _ref_tipo := 'badge';
    SELECT b.codigo, b.nome INTO _codigo, _nome
      FROM public.clube_aluno_badges cab JOIN public.clube_badges b ON b.id = cab.badge_id
      WHERE cab.id = p_referencia_id AND cab.aluno_id = _eu;
    IF _codigo IS NOT NULL AND (p_tipo = 'sequencia') = (_codigo = 'sequencia_30') THEN
      _payload := CASE WHEN p_tipo = 'sequencia'
        THEN jsonb_build_object('nome', _nome, 'codigo', _codigo, 'semanas', 8)
        ELSE jsonb_build_object('nome', _nome, 'codigo', _codigo) END;
    END IF;
  ELSE
    RAISE EXCEPTION 'tipo_indisponivel';
  END IF;
  IF _payload IS NULL THEN RAISE EXCEPTION 'evento_invalido' USING ERRCODE = '42501'; END IF;

  IF p_foto_path IS NOT NULL THEN
    IF split_part(p_foto_path, '/', 1) <> _eu::text OR NOT EXISTS (
      SELECT 1 FROM storage.objects WHERE bucket_id = 'comunidade-feed' AND name = p_foto_path) THEN
      RAISE EXCEPTION 'foto_invalida';
    END IF;
  END IF;

  -- Foto entra publicada na hora; moderação é posterior (denúncia, ocultar/remover, suspensão).
  INSERT INTO public.comunidade_feed_posts (aluno_id, tipo, referencia_tipo, referencia_id, payload, audiencia, foto_path, status)
  VALUES (_eu, p_tipo, _ref_tipo, p_referencia_id, _payload, p_audiencia, p_foto_path, 'publicado')
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ja_compartilhado';
END $$;

UPDATE public.comunidade_feed_posts SET status = 'publicado' WHERE status = 'foto_pendente';

COMMENT ON COLUMN public.comunidade_feed_posts.status IS 'publicado | oculto | removido. foto_pendente: DEPRECATED, mantido no CHECK só por compatibilidade.';