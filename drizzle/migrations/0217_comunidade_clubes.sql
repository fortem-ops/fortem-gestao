-- Comunidade: clubes de alunos e ranking por dias de treino. Independente das tabelas clube_* (programa de pontos).
CREATE TABLE public.comunidade_clubes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 3 AND 40),
  descricao text CHECK (descricao IS NULL OR length(descricao) <= 200),
  tipo text NOT NULL DEFAULT 'aluno' CHECK (tipo IN ('oficial','aluno')),
  modalidade text NOT NULL DEFAULT 'todas' CHECK (modalidade IN ('todas','funcional','corrida')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','recusado','encerrado')),
  criador_aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  aprovado_por uuid,
  aprovado_em timestamptz,
  motivo_recusa text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX comunidade_clubes_nome_unico ON public.comunidade_clubes (lower(btrim(nome)));
CREATE INDEX comunidade_clubes_criador_idx ON public.comunidade_clubes (criador_aluno_id);

CREATE TABLE public.comunidade_clube_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clube_id uuid NOT NULL REFERENCES public.comunidade_clubes(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('anfitriao','membro')),
  entrou_em timestamptz NOT NULL DEFAULT now(),
  saiu_em timestamptz
);
CREATE UNIQUE INDEX comunidade_membro_ativo_unico ON public.comunidade_clube_membros (clube_id, aluno_id) WHERE saiu_em IS NULL;
CREATE INDEX comunidade_membros_aluno_idx ON public.comunidade_clube_membros (aluno_id) WHERE saiu_em IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunidade_clubes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunidade_clube_membros TO authenticated;
GRANT ALL ON public.comunidade_clubes TO service_role;
GRANT ALL ON public.comunidade_clube_membros TO service_role;

-- Aluno do usuário logado
CREATE OR REPLACE FUNCTION public.fn_comunidade_meu_aluno()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.alunos WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1;
$$;

-- "Carolina Martins Souza" -> "Carolina S."
CREATE OR REPLACE FUNCTION public.fn_comunidade_nome_abreviado(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p IS NULL OR array_length(p,1) IS NULL THEN 'Aluno'
    WHEN array_length(p,1) = 1 THEN initcap(p[1])
    ELSE initcap(p[1]) || ' ' || upper(left(p[array_length(p,1)],1)) || '.'
  END
  FROM (SELECT regexp_split_to_array(btrim(coalesce(p_nome,'')), '\s+') FILTER_NULL) s(p0),
       LATERAL (SELECT CASE WHEN btrim(coalesce(p_nome,'')) = '' THEN NULL ELSE s.p0 END) x(p);
$$;

ALTER TABLE public.comunidade_clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidade_clube_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunidade_clubes_select" ON public.comunidade_clubes FOR SELECT TO authenticated
  USING (public.is_staff() OR status = 'ativo' OR criador_aluno_id = public.fn_comunidade_meu_aluno());
CREATE POLICY "comunidade_clubes_insert" ON public.comunidade_clubes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR (tipo = 'aluno' AND status = 'pendente' AND aprovado_por IS NULL
    AND aprovado_em IS NULL AND criador_aluno_id = public.fn_comunidade_meu_aluno()));
CREATE POLICY "comunidade_clubes_update_staff" ON public.comunidade_clubes FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "comunidade_clubes_delete_staff" ON public.comunidade_clubes FOR DELETE TO authenticated
  USING (public.is_staff());

CREATE POLICY "comunidade_membros_select" ON public.comunidade_clube_membros FOR SELECT TO authenticated
  USING (public.is_staff() OR aluno_id = public.fn_comunidade_meu_aluno());
CREATE POLICY "comunidade_membros_write_staff" ON public.comunidade_clube_membros FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Regras de criação para quem não é equipe: sempre pendente, limites e nomes reservados
CREATE OR REPLACE FUNCTION public.fn_comunidade_clubes_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.nome := btrim(NEW.nome);
  IF auth.uid() IS NULL OR public.is_staff() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  NEW.tipo := 'aluno'; NEW.status := 'pendente';
  NEW.aprovado_por := NULL; NEW.aprovado_em := NULL; NEW.motivo_recusa := NULL;
  IF NEW.criador_aluno_id IS DISTINCT FROM public.fn_comunidade_meu_aluno() OR NEW.criador_aluno_id IS NULL THEN
    RAISE EXCEPTION 'criador_invalido';
  END IF;
  IF NEW.nome ~* '(fortem|oficial)' THEN RAISE EXCEPTION 'nome_reservado'; END IF;
  IF EXISTS (SELECT 1 FROM public.comunidade_clubes WHERE criador_aluno_id = NEW.criador_aluno_id AND status = 'pendente') THEN
    RAISE EXCEPTION 'limite_pendente';
  END IF;
  IF (SELECT count(*) FROM public.comunidade_clubes WHERE criador_aluno_id = NEW.criador_aluno_id AND status = 'ativo') >= 2 THEN
    RAISE EXCEPTION 'limite_ativos';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_comunidade_clubes_validar BEFORE INSERT OR UPDATE ON public.comunidade_clubes
  FOR EACH ROW EXECUTE FUNCTION public.fn_comunidade_clubes_validar();

-- Ranking interno (sem checagem de acesso; só chamado por funções que checam)
CREATE OR REPLACE FUNCTION public.fn_comunidade_ranking_interno(p_clube_id uuid, p_mes date)
RETURNS TABLE(posicao int, aluno_id uuid, nome text, plano_chave text, dias int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT modalidade FROM public.comunidade_clubes WHERE id = p_clube_id),
  per AS (SELECT date_trunc('month', coalesce(p_mes, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date AS ini),
  m AS (
    SELECT mb.aluno_id, a.nome FROM public.comunidade_clube_membros mb
    JOIN public.alunos a ON a.id = mb.aluno_id
    WHERE mb.clube_id = p_clube_id AND mb.saiu_em IS NULL
  ),
  d AS (
    SELECT m.aluno_id, m.nome, (
      SELECT count(DISTINCT ta.data)::int FROM public.treino_agendamentos ta
      LEFT JOIN public.treino_slots ts ON ts.id = ta.slot_id
      CROSS JOIN c CROSS JOIN per
      WHERE ta.aluno_id = m.aluno_id AND ta.status = 'realizado'
        AND ta.data >= per.ini AND ta.data < (per.ini + interval '1 month')::date
        AND (c.modalidade = 'todas'
             OR (c.modalidade = 'funcional' AND ts.modalidade = 'treino')
             OR (c.modalidade = 'corrida' AND ts.modalidade = 'corrida'))
    ) AS dias FROM m
  )
  SELECT (rank() OVER (ORDER BY d.dias DESC))::int, d.aluno_id,
         public.fn_comunidade_nome_abreviado(d.nome),
         public.fn_clube_plano_info(d.aluno_id)->>'chave', d.dias
  FROM d ORDER BY d.dias DESC, public.fn_comunidade_nome_abreviado(d.nome), d.aluno_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_ranking_clube(p_clube_id uuid, p_mes date DEFAULT NULL)
RETURNS TABLE(posicao int, nome text, plano_chave text, dias int, eh_voce boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF NOT (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.comunidade_clube_membros
    WHERE clube_id = p_clube_id AND aluno_id = _eu AND saiu_em IS NULL)) THEN
    RAISE EXCEPTION 'sem_acesso_ranking' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT r.posicao, r.nome, r.plano_chave, r.dias, (r.aluno_id = _eu)
    FROM public.fn_comunidade_ranking_interno(p_clube_id, p_mes) r;
END $$;

-- Lista para o portal: clubes visíveis, membros, minha posição
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

CREATE OR REPLACE FUNCTION public.fn_comunidade_entrar(p_clube_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno();
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comunidade_clubes WHERE id = p_clube_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'clube_indisponivel';
  END IF;
  INSERT INTO public.comunidade_clube_membros (clube_id, aluno_id, papel)
  VALUES (p_clube_id, _eu, 'membro') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_sair(p_clube_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno(); _era_anf boolean;
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno'; END IF;
  UPDATE public.comunidade_clube_membros SET saiu_em = now()
   WHERE clube_id = p_clube_id AND aluno_id = _eu AND saiu_em IS NULL
   RETURNING papel = 'anfitriao' INTO _era_anf;
  IF coalesce(_era_anf, false) THEN
    -- passa a anfitriã(o) para o membro mais antigo
    UPDATE public.comunidade_clube_membros SET papel = 'anfitriao'
     WHERE id = (SELECT id FROM public.comunidade_clube_membros
                  WHERE clube_id = p_clube_id AND saiu_em IS NULL ORDER BY entrou_em LIMIT 1);
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_comunidade_criar_clube(p_nome text, p_descricao text, p_modalidade text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno(); _id uuid;
BEGIN
  IF _eu IS NULL THEN RAISE EXCEPTION 'sem_aluno'; END IF;
  INSERT INTO public.comunidade_clubes (nome, descricao, tipo, modalidade, status, criador_aluno_id)
  VALUES (btrim(p_nome), nullif(btrim(coalesce(p_descricao,'')),''), 'aluno', coalesce(p_modalidade,'todas'), 'pendente', _eu)
  RETURNING id INTO _id;
  INSERT INTO public.comunidade_clube_membros (clube_id, aluno_id, papel) VALUES (_id, _eu, 'anfitriao');
  RETURN jsonb_build_object('ok', true, 'id', _id, 'status', 'pendente');
END $$;

-- Equipe: aprovar / recusar / encerrar, com aviso ao criador pela central de notificações do portal
CREATE OR REPLACE FUNCTION public.fn_comunidade_moderar(p_clube_id uuid, p_acao text, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.comunidade_clubes;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.comunidade_clubes WHERE id = p_clube_id FOR UPDATE;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'clube_inexistente'; END IF;
  IF p_acao = 'aprovar' THEN
    UPDATE public.comunidade_clubes SET status = 'ativo', aprovado_por = auth.uid(), aprovado_em = now(), motivo_recusa = NULL WHERE id = p_clube_id;
  ELSIF p_acao = 'recusar' THEN
    IF btrim(coalesce(p_motivo,'')) = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
    UPDATE public.comunidade_clubes SET status = 'recusado', motivo_recusa = btrim(p_motivo) WHERE id = p_clube_id;
  ELSIF p_acao = 'encerrar' THEN
    UPDATE public.comunidade_clubes SET status = 'encerrado' WHERE id = p_clube_id;
  ELSE RAISE EXCEPTION 'acao_invalida'; END IF;

  IF _c.criador_aluno_id IS NOT NULL AND p_acao IN ('aprovar','recusar') THEN
    PERFORM public.fn_call_edge_function('send-push-notification', jsonb_build_object(
      'aluno_id', _c.criador_aluno_id,
      'title', CASE WHEN p_acao = 'aprovar' THEN 'Clube aprovado' ELSE 'Clube não aprovado' END,
      'body', CASE WHEN p_acao = 'aprovar' THEN 'O clube ' || _c.nome || ' já aparece na Comunidade.'
                   ELSE 'O clube ' || _c.nome || ' não foi aprovado. Motivo: ' || btrim(p_motivo) END,
      'url', '/portal/comunidade', 'gatilho', 'comunidade_clube'));
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.fn_comunidade_meu_aluno() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_comunidade_ranking_interno(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_comunidade_ranking_clube(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_comunidade_meus_clubes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_comunidade_entrar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_comunidade_sair(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_comunidade_criar_clube(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_comunidade_moderar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_meu_aluno() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_ranking_interno(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_ranking_clube(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_meus_clubes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_entrar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_sair(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_criar_clube(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_moderar(uuid, text, text) TO authenticated;