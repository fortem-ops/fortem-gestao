ALTER TABLE public.comunidade_clubes ADD COLUMN IF NOT EXISTS capa_url text;
COMMENT ON COLUMN public.comunidade_clubes.capa_url IS 'Caminho do objeto no bucket privado comunidade-clubes ({aluno_id ou equipe}/{uuid}.ext)';
ALTER TABLE public.comunidade_clubes ADD CONSTRAINT comunidade_clubes_descricao_120 CHECK (descricao IS NULL OR length(descricao) <= 120) NOT VALID;
ALTER TABLE public.comunidade_clubes VALIDATE CONSTRAINT comunidade_clubes_descricao_120;

CREATE OR REPLACE FUNCTION public.fn_comunidade_criar_clube(p_nome text, p_descricao text, p_modalidade text, p_capa_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno(); _id uuid; _capa text := nullif(btrim(coalesce(p_capa_url,'')),'');
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno'; END IF;
  IF length(coalesce(btrim(p_descricao),'')) > 120 THEN RAISE EXCEPTION 'descricao_longa'; END IF;
  IF _capa IS NOT NULL AND (_capa NOT LIKE _eu::text || '/%' OR lower(_capa) !~ '\.(jpe?g|png|webp)$') THEN
    RAISE EXCEPTION 'capa_invalida';
  END IF;
  INSERT INTO public.comunidade_clubes (nome, descricao, tipo, modalidade, status, criador_aluno_id, capa_url)
  VALUES (btrim(p_nome), nullif(btrim(coalesce(p_descricao,'')),''), 'aluno', coalesce(p_modalidade,'todas'), 'pendente', _eu, _capa)
  RETURNING id INTO _id;
  INSERT INTO public.comunidade_clube_membros (clube_id, aluno_id, papel) VALUES (_id, _eu, 'anfitriao');
  RETURN jsonb_build_object('ok', true, 'id', _id, 'status', 'pendente');
END $$;
REVOKE ALL ON FUNCTION public.fn_comunidade_criar_clube(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_criar_clube(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_comunidade_meus_clubes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF _eu IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x->>'sou_membro')::boolean DESC, x->>'tipo' DESC, x->>'nome') FROM (
      SELECT jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'descricao', c.descricao, 'tipo', c.tipo,
        'modalidade', c.modalidade, 'status', c.status, 'motivo_recusa', c.motivo_recusa,
        'capa_url', c.capa_url,
        'sou_criador', c.criador_aluno_id = _eu,
        'membros', (SELECT count(*) FROM public.comunidade_clube_membros WHERE clube_id = c.id AND saiu_em IS NULL),
        'sou_membro', EXISTS (SELECT 1 FROM public.comunidade_clube_membros WHERE clube_id = c.id AND aluno_id = _eu AND saiu_em IS NULL),
        'anfitriao', CASE WHEN c.tipo = 'oficial' THEN 'Equipe Fortem' ELSE (
          SELECT public.fn_comunidade_nome_abreviado(a.nome) FROM public.comunidade_clube_membros mb
          JOIN public.alunos a ON a.id = mb.aluno_id
          WHERE mb.clube_id = c.id AND mb.papel = 'anfitriao' AND mb.saiu_em IS NULL LIMIT 1) END,
        'minha_posicao', r.posicao, 'meus_dias', r.dias
      ) AS x
      FROM public.comunidade_clubes c
      LEFT JOIN LATERAL (
        SELECT ri.posicao, ri.dias FROM public.fn_comunidade_ranking_interno(c.id, NULL) ri
        WHERE ri.aluno_id = _eu AND c.status = 'ativo'
          AND EXISTS (SELECT 1 FROM public.comunidade_clube_membros WHERE clube_id = c.id AND aluno_id = _eu AND saiu_em IS NULL)
      ) r ON true
      WHERE c.status = 'ativo' OR (c.criador_aluno_id = _eu AND c.status IN ('pendente','recusado'))
    ) t
  ), '[]'::jsonb);
END $$;

-- Storage: leitura para usuários logados; escrita da equipe em qualquer caminho, aluno só em {aluno_id}/; só jpg/png/webp
CREATE POLICY "comunidade_capas_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comunidade-clubes');
CREATE POLICY "comunidade_capas_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comunidade-clubes'
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
    AND (public.is_staff() OR (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text));
CREATE POLICY "comunidade_capas_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comunidade-clubes' AND (public.is_staff() OR (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text))
  WITH CHECK (bucket_id = 'comunidade-clubes'
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
    AND (public.is_staff() OR (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text));
CREATE POLICY "comunidade_capas_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comunidade-clubes' AND (public.is_staff() OR (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text));