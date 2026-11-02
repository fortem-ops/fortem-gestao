-- Comunidade: feed de eventos reconhecidos pelo sistema (opcional, moderado). Sem posts livres.
CREATE TABLE public.comunidade_consentimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL UNIQUE REFERENCES public.alunos(id) ON DELETE CASCADE,
  versao_termo text NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz,
  suspenso_em timestamptz,
  suspenso_por uuid
);

CREATE TABLE public.comunidade_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('treino','conquista','sequencia','recorde')),
  referencia_tipo text NOT NULL,
  referencia_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  audiencia text NOT NULL DEFAULT 'clubes' CHECK (audiencia IN ('fortem','clubes')),
  foto_path text,
  status text NOT NULL CHECK (status IN ('publicado','foto_pendente','oculto','removido')),
  moderado_por uuid,
  moderado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
CREATE UNIQUE INDEX comunidade_feed_ref_unica ON public.comunidade_feed_posts (aluno_id, referencia_tipo, referencia_id);
CREATE INDEX comunidade_feed_publicados_idx ON public.comunidade_feed_posts (created_at DESC) WHERE status = 'publicado';
CREATE INDEX comunidade_feed_aluno_idx ON public.comunidade_feed_posts (aluno_id, created_at DESC);

CREATE TABLE public.comunidade_feed_reacoes (
  post_id uuid NOT NULL REFERENCES public.comunidade_feed_posts(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, aluno_id)
);

CREATE TABLE public.comunidade_feed_denuncias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.comunidade_feed_posts(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  motivo text NOT NULL CHECK (motivo IN ('inadequado','pessoa_identificavel','spam','outro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  UNIQUE (post_id, aluno_id)
);

-- Aluno não escreve direto: só leitura (filtrada por RLS) e escrita via funções.
GRANT SELECT ON public.comunidade_consentimentos, public.comunidade_feed_posts,
  public.comunidade_feed_reacoes, public.comunidade_feed_denuncias TO authenticated;
GRANT ALL ON public.comunidade_consentimentos, public.comunidade_feed_posts,
  public.comunidade_feed_reacoes, public.comunidade_feed_denuncias TO service_role;

ALTER TABLE public.comunidade_consentimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidade_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidade_feed_reacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidade_feed_denuncias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunidade_consent_select" ON public.comunidade_consentimentos FOR SELECT TO authenticated
  USING (public.is_staff() OR aluno_id = public.fn_comunidade_meu_aluno());
CREATE POLICY "comunidade_feed_posts_staff" ON public.comunidade_feed_posts FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "comunidade_feed_reacoes_staff" ON public.comunidade_feed_reacoes FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "comunidade_feed_denuncias_staff" ON public.comunidade_feed_denuncias FOR SELECT TO authenticated
  USING (public.is_staff());

-- ---------- Auxiliares ----------
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_participa(p_aluno uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.comunidade_consentimentos
                 WHERE aluno_id = p_aluno AND revogado_em IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_pode_publicar(p_aluno uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.comunidade_consentimentos
                 WHERE aluno_id = p_aluno AND revogado_em IS NULL AND suspenso_em IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_clube_em_comum(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comunidade_clube_membros m1
    JOIN public.comunidade_clube_membros m2 ON m2.clube_id = m1.clube_id AND m2.saiu_em IS NULL
    JOIN public.comunidade_clubes c ON c.id = m1.clube_id AND c.status = 'ativo'
    WHERE m1.aluno_id = p_a AND m2.aluno_id = p_b AND m1.saiu_em IS NULL);
$$;

-- Post visível para um aluno participante
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_pode_ver(p_post uuid, p_eu uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comunidade_feed_posts p
    WHERE p.id = p_post AND p.status = 'publicado' AND p.created_at > now() - interval '30 days'
      AND public.fn_comunidade_feed_participa(p_eu)
      AND (p.aluno_id = p_eu OR p.audiencia = 'fortem' OR public.fn_comunidade_clube_em_comum(p.aluno_id, p_eu)));
$$;

-- ---------- Consentimento ----------
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'participa', coalesce(c.revogado_em IS NULL, false) AND c.id IS NOT NULL,
    'suspenso', c.id IS NOT NULL AND c.revogado_em IS NULL AND c.suspenso_em IS NOT NULL,
    'versao_termo', c.versao_termo)
  FROM (SELECT 1) x LEFT JOIN public.comunidade_consentimentos c ON c.aluno_id = public.fn_comunidade_meu_aluno();
$$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_aceitar(p_versao text DEFAULT 'v1')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.comunidade_consentimentos (aluno_id, versao_termo, aceito_em)
  VALUES (_eu, coalesce(nullif(btrim(p_versao),''),'v1'), now())
  ON CONFLICT (aluno_id) DO UPDATE SET versao_termo = EXCLUDED.versao_termo, aceito_em = now(), revogado_em = NULL;
END $$;

-- Revogar: oculta todas as publicações e devolve os caminhos das fotos (o app apaga do armazenamento;
-- a rotina diária apaga o que restar).
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_revogar()
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno(); _fotos text[];
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno' USING ERRCODE = '42501'; END IF;
  UPDATE public.comunidade_consentimentos SET revogado_em = now() WHERE aluno_id = _eu AND revogado_em IS NULL;
  SELECT coalesce(array_agg(foto_path) FILTER (WHERE foto_path IS NOT NULL), '{}') INTO _fotos
    FROM public.comunidade_feed_posts WHERE aluno_id = _eu;
  UPDATE public.comunidade_feed_posts SET status = 'oculto'
    WHERE aluno_id = _eu AND status IN ('publicado','foto_pendente');
  RETURN _fotos;
END $$;

-- ---------- O que o aluno pode compartilhar agora ----------
CREATE OR REPLACE FUNCTION public.fn_comunidade_compartilhaveis()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH eu AS (SELECT public.fn_comunidade_meu_aluno() AS id),
  hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d)
  SELECT jsonb_build_object(
    'treino', (
      SELECT jsonb_build_object('id', ta.id,
        'modalidade', CASE WHEN ts.modalidade = 'corrida' THEN 'Corrida' ELSE 'Funcional' END,
        'horario', to_char(ta.horario_inicio, 'HH24:MI'))
      FROM public.treino_agendamentos ta LEFT JOIN public.treino_slots ts ON ts.id = ta.slot_id, eu, hoje
      WHERE ta.aluno_id = eu.id AND ta.status = 'realizado' AND ta.data = hoje.d
        AND NOT EXISTS (SELECT 1 FROM public.comunidade_feed_posts p
                        WHERE p.aluno_id = eu.id AND p.referencia_tipo = 'treino' AND p.referencia_id = ta.id)
      ORDER BY ta.horario_inicio DESC LIMIT 1),
    'conquistas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', cab.id, 'nome', b.nome, 'codigo', b.codigo,
               'tipo', CASE WHEN b.codigo = 'sequencia_30' THEN 'sequencia' ELSE 'conquista' END)
             ORDER BY cab.conquistado_em DESC)
      FROM public.clube_aluno_badges cab JOIN public.clube_badges b ON b.id = cab.badge_id, eu
      WHERE cab.aluno_id = eu.id AND cab.conquistado_em > now() - interval '14 days'
        AND NOT EXISTS (SELECT 1 FROM public.comunidade_feed_posts p
                        WHERE p.aluno_id = eu.id AND p.referencia_tipo = 'badge' AND p.referencia_id = cab.id)), '[]'::jsonb));
$$;

-- ---------- Publicar (única porta de entrada) ----------
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
    -- 'recorde' não existe ainda: o sistema não guarda carga recorde do 5-3-1.
    RAISE EXCEPTION 'tipo_indisponivel';
  END IF;
  IF _payload IS NULL THEN RAISE EXCEPTION 'evento_invalido' USING ERRCODE = '42501'; END IF;

  IF p_foto_path IS NOT NULL THEN
    IF split_part(p_foto_path, '/', 1) <> _eu::text OR NOT EXISTS (
      SELECT 1 FROM storage.objects WHERE bucket_id = 'comunidade-feed' AND name = p_foto_path) THEN
      RAISE EXCEPTION 'foto_invalida';
    END IF;
  END IF;

  INSERT INTO public.comunidade_feed_posts (aluno_id, tipo, referencia_tipo, referencia_id, payload, audiencia, foto_path, status)
  VALUES (_eu, p_tipo, _ref_tipo, p_referencia_id, _payload, p_audiencia, p_foto_path,
          CASE WHEN p_foto_path IS NULL THEN 'publicado' ELSE 'foto_pendente' END)
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ja_compartilhado';
END $$;

-- ---------- Leitura do feed ----------
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed(p_filtro text DEFAULT 'fortem', p_limite int DEFAULT 20, p_antes timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, eh_meu boolean, nome text, plano_chave text, tipo text, payload jsonb, audiencia text,
              foto_path text, created_at timestamptz, reacoes int, eu_reagi boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF _eu IS NULL OR NOT public.fn_comunidade_feed_participa(_eu) THEN
    RAISE EXCEPTION 'sem_consentimento' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.aluno_id = _eu, public.fn_comunidade_nome_abreviado(a.nome),
         public.fn_clube_plano_info(p.aluno_id)->>'chave', p.tipo, p.payload, p.audiencia, p.foto_path, p.created_at,
         (SELECT count(*)::int FROM public.comunidade_feed_reacoes r WHERE r.post_id = p.id),
         EXISTS (SELECT 1 FROM public.comunidade_feed_reacoes r WHERE r.post_id = p.id AND r.aluno_id = _eu)
  FROM public.comunidade_feed_posts p JOIN public.alunos a ON a.id = p.aluno_id
  WHERE p.status = 'publicado' AND p.created_at > now() - interval '30 days'
    AND (p_antes IS NULL OR p.created_at < p_antes)
    AND CASE WHEN p_filtro = 'clubes' THEN public.fn_comunidade_clube_em_comum(p.aluno_id, _eu)
             ELSE p.audiencia = 'fortem' END
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(p_limite, 20), 1), 50);
END $$;

-- ---------- Interações ----------
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_reagir(p_post uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF NOT public.fn_comunidade_feed_pode_publicar(_eu) THEN RAISE EXCEPTION 'sem_consentimento' USING ERRCODE = '42501'; END IF;
  IF NOT public.fn_comunidade_feed_pode_ver(p_post, _eu) THEN RAISE EXCEPTION 'post_indisponivel'; END IF;
  INSERT INTO public.comunidade_feed_reacoes (post_id, aluno_id) VALUES (p_post, _eu) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_desreagir(p_post uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.comunidade_feed_reacoes WHERE post_id = p_post AND aluno_id = public.fn_comunidade_meu_aluno();
$$;

-- Apagar o próprio post: devolve o caminho da foto para o app apagar do armazenamento.
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_apagar(p_post uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno(); _foto text;
BEGIN
  UPDATE public.comunidade_feed_posts SET status = 'removido'
    WHERE id = p_post AND aluno_id = _eu AND _eu IS NOT NULL
    RETURNING foto_path INTO _foto;
  IF NOT FOUND THEN RAISE EXCEPTION 'post_indisponivel'; END IF;
  RETURN _foto;
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_denunciar(p_post uuid, p_motivo text DEFAULT 'inadequado')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF NOT public.fn_comunidade_feed_pode_ver(p_post, _eu) THEN RAISE EXCEPTION 'post_indisponivel'; END IF;
  IF EXISTS (SELECT 1 FROM public.comunidade_feed_posts WHERE id = p_post AND aluno_id = _eu) THEN
    RAISE EXCEPTION 'post_proprio';
  END IF;
  INSERT INTO public.comunidade_feed_denuncias (post_id, aluno_id, motivo) VALUES (p_post, _eu, p_motivo);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja_denunciado';
END $$;

-- ---------- Moderação (equipe) ----------
-- p_acao: aprovar | recusar | ocultar | remover. Devolve a foto a apagar (recusar/remover).
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_moderar(p_post uuid, p_acao text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _foto text; _status text;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT foto_path, status INTO _foto, _status FROM public.comunidade_feed_posts WHERE id = p_post FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'post_indisponivel'; END IF;
  IF p_acao = 'aprovar' THEN
    IF _status <> 'foto_pendente' THEN RAISE EXCEPTION 'post_indisponivel'; END IF;
    UPDATE public.comunidade_feed_posts SET status = 'publicado', moderado_por = auth.uid(), moderado_em = now() WHERE id = p_post;
    RETURN NULL;
  ELSIF p_acao = 'ocultar' THEN
    UPDATE public.comunidade_feed_posts SET status = 'oculto', moderado_por = auth.uid(), moderado_em = now() WHERE id = p_post;
  ELSIF p_acao IN ('recusar','remover') THEN
    UPDATE public.comunidade_feed_posts SET status = 'removido', moderado_por = auth.uid(), moderado_em = now() WHERE id = p_post;
  ELSE
    RAISE EXCEPTION 'acao_invalida';
  END IF;
  UPDATE public.comunidade_feed_denuncias SET resolvido_em = now(), resolvido_por = auth.uid()
    WHERE post_id = p_post AND resolvido_em IS NULL;
  RETURN CASE WHEN p_acao IN ('recusar','remover') THEN _foto END;
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_dispensar_denuncias(p_post uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  UPDATE public.comunidade_feed_denuncias SET resolvido_em = now(), resolvido_por = auth.uid()
    WHERE post_id = p_post AND resolvido_em IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_suspender(p_aluno uuid, p_suspender boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  UPDATE public.comunidade_consentimentos
    SET suspenso_em = CASE WHEN p_suspender THEN now() END,
        suspenso_por = CASE WHEN p_suspender THEN auth.uid() END
    WHERE aluno_id = p_aluno;
  IF NOT FOUND THEN RAISE EXCEPTION 'sem_consentimento'; END IF;
END $$;

-- ---------- Rotina diária (só service_role, chamada pela função de limpeza) ----------
-- Marca expirados como removidos e lista fotos a apagar: removidos, com mais de 90 dias ou de quem saiu do feed.
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_expirar()
RETURNS TABLE(post_id uuid, foto_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.comunidade_feed_posts SET status = 'removido' WHERE expira_em < now() AND status <> 'removido';
  RETURN QUERY
  SELECT p.id, p.foto_path FROM public.comunidade_feed_posts p
  WHERE p.foto_path IS NOT NULL
    AND (p.status = 'removido' OR p.created_at < now() - interval '90 days'
         OR EXISTS (SELECT 1 FROM public.comunidade_consentimentos c WHERE c.aluno_id = p.aluno_id AND c.revogado_em IS NOT NULL));
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_fotos_apagadas(p_posts uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.comunidade_feed_posts SET foto_path = NULL WHERE id = ANY(p_posts);
$$;

-- Permissões das funções
REVOKE ALL ON FUNCTION public.fn_comunidade_feed_participa(uuid), public.fn_comunidade_feed_pode_publicar(uuid),
  public.fn_comunidade_clube_em_comum(uuid, uuid), public.fn_comunidade_feed_pode_ver(uuid, uuid),
  public.fn_comunidade_feed_expirar(), public.fn_comunidade_feed_fotos_apagadas(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_feed_expirar(), public.fn_comunidade_feed_fotos_apagadas(uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.fn_comunidade_feed_status(), public.fn_comunidade_feed_aceitar(text), public.fn_comunidade_feed_revogar(),
  public.fn_comunidade_compartilhaveis(), public.fn_comunidade_compartilhar(text, uuid, text, text),
  public.fn_comunidade_feed(text, int, timestamptz), public.fn_comunidade_feed_reagir(uuid), public.fn_comunidade_feed_desreagir(uuid),
  public.fn_comunidade_feed_apagar(uuid), public.fn_comunidade_feed_denunciar(uuid, text), public.fn_comunidade_feed_moderar(uuid, text),
  public.fn_comunidade_feed_dispensar_denuncias(uuid), public.fn_comunidade_feed_suspender(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_feed_status(), public.fn_comunidade_feed_aceitar(text), public.fn_comunidade_feed_revogar(),
  public.fn_comunidade_compartilhaveis(), public.fn_comunidade_compartilhar(text, uuid, text, text),
  public.fn_comunidade_feed(text, int, timestamptz), public.fn_comunidade_feed_reagir(uuid), public.fn_comunidade_feed_desreagir(uuid),
  public.fn_comunidade_feed_apagar(uuid), public.fn_comunidade_feed_denunciar(uuid, text), public.fn_comunidade_feed_moderar(uuid, text),
  public.fn_comunidade_feed_dispensar_denuncias(uuid), public.fn_comunidade_feed_suspender(uuid, boolean) TO authenticated, service_role;

-- Foto visível a um participante (usada pela política de leitura do armazenamento)
CREATE OR REPLACE FUNCTION public.fn_comunidade_feed_foto_visivel(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.comunidade_feed_posts p
                 WHERE p.foto_path = p_nome AND public.fn_comunidade_feed_pode_ver(p.id, public.fn_comunidade_meu_aluno()));
$$;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_feed_foto_visivel(text) TO authenticated;

-- ---------- Armazenamento: bucket privado comunidade-feed ----------
CREATE POLICY "comunidade_feed_fotos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comunidade-feed' AND (public.is_staff()
    OR (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text
    OR public.fn_comunidade_feed_foto_visivel(name)));
CREATE POLICY "comunidade_feed_fotos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comunidade-feed'
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
    AND (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text);
CREATE POLICY "comunidade_feed_fotos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comunidade-feed' AND (public.is_staff()
    OR (storage.foldername(name))[1] = public.fn_comunidade_meu_aluno()::text));