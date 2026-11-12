-- Fotos de eventos com reconhecimento facial (Fase 1). Público só via funções do servidor.
CREATE OR REPLACE FUNCTION public.fn_fotos_pode_gerir(_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','coordenador'))
$$;
CREATE OR REPLACE FUNCTION public.fn_fotos_pode_moderar(_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','coordenador','professor'))
$$;

CREATE TABLE public.eventos_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  nome text NOT NULL,
  data date NOT NULL,
  collection_id text NOT NULL UNIQUE CHECK (collection_id ~ '^fortem-[a-zA-Z0-9_.-]{1,240}$'),
  colecao_criada_em timestamptz,
  texto_assinatura text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  retencao_dias integer NOT NULL DEFAULT 90 CHECK (retencao_dias BETWEEN 1 AND 3650),
  retencao_executada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.leads_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_fotos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  whatsapp text NOT NULL CHECK (whatsapp ~ '^[0-9]{10,15}$'),
  email text,
  aceite_biometria boolean NOT NULL DEFAULT false,
  aceite_biometria_em timestamptz,
  aceite_publicacao boolean NOT NULL DEFAULT false,
  aceite_publicacao_em timestamptz,
  qtd_buscas integer NOT NULL DEFAULT 0,
  qtd_fotos_encontradas integer NOT NULL DEFAULT 0,
  qtd_fotos_enviadas integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, whatsapp)
);

CREATE TABLE public.fotos_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_fotos(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  storage_path_preview text,
  largura integer,
  altura integer,
  orientacao text CHECK (orientacao IN ('horizontal','vertical')),
  origem text NOT NULL CHECK (origem IN ('fotografo','convidado')),
  enviado_por uuid REFERENCES public.leads_fotos(id) ON DELETE SET NULL,
  envio_id uuid,
  upload_concluido boolean NOT NULL DEFAULT false,
  status_moderacao text NOT NULL DEFAULT 'pendente' CHECK (status_moderacao IN ('pendente','aprovada','rejeitada')),
  moderado_por uuid,
  moderado_em timestamptz,
  status_indexacao text NOT NULL DEFAULT 'pendente' CHECK (status_indexacao IN ('pendente','indexada','erro','sem_rosto')),
  erro_indexacao text,
  qtd_rostos integer NOT NULL DEFAULT 0,
  alerta_moderacao boolean NOT NULL DEFAULT false,
  rotulos_moderacao jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fotos_evento_evento_status_idx ON public.fotos_evento (evento_id, status_moderacao, status_indexacao);
CREATE INDEX fotos_evento_envio_idx ON public.fotos_evento (envio_id);

CREATE TABLE public.rostos_foto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_id uuid NOT NULL REFERENCES public.fotos_evento(id) ON DELETE CASCADE,
  face_id_rekognition text NOT NULL UNIQUE
);
CREATE INDEX rostos_foto_foto_idx ON public.rostos_foto (foto_id);

-- Só contadores da busca; nenhuma imagem.
CREATE TABLE public.fotos_buscas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_fotos(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads_fotos(id) ON DELETE SET NULL,
  qtd_encontradas integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rate_limit_fotos_publico (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('busca','envio')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_fotos_publico_idx ON public.rate_limit_fotos_publico (ip_hash, acao, criado_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_fotos TO authenticated;
GRANT SELECT, UPDATE ON public.fotos_evento TO authenticated;
GRANT SELECT ON public.rostos_foto TO authenticated;
GRANT SELECT ON public.leads_fotos TO authenticated;
GRANT SELECT ON public.fotos_buscas_log TO authenticated;
GRANT ALL ON public.eventos_fotos, public.fotos_evento, public.rostos_foto, public.leads_fotos, public.fotos_buscas_log, public.rate_limit_fotos_publico TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_fotos_publico_id_seq TO service_role;

ALTER TABLE public.eventos_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rostos_foto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_buscas_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_fotos_publico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_fotos staff le" ON public.eventos_fotos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "eventos_fotos gestao insere" ON public.eventos_fotos FOR INSERT TO authenticated WITH CHECK (public.fn_fotos_pode_gerir(auth.uid()));
CREATE POLICY "eventos_fotos gestao altera" ON public.eventos_fotos FOR UPDATE TO authenticated USING (public.fn_fotos_pode_gerir(auth.uid())) WITH CHECK (public.fn_fotos_pode_gerir(auth.uid()));
CREATE POLICY "eventos_fotos gestao apaga" ON public.eventos_fotos FOR DELETE TO authenticated USING (public.fn_fotos_pode_gerir(auth.uid()));
CREATE POLICY "fotos_evento staff le" ON public.fotos_evento FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "fotos_evento moderacao altera" ON public.fotos_evento FOR UPDATE TO authenticated USING (public.fn_fotos_pode_moderar(auth.uid())) WITH CHECK (public.fn_fotos_pode_moderar(auth.uid()));
CREATE POLICY "rostos_foto staff le" ON public.rostos_foto FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "leads_fotos gestao le" ON public.leads_fotos FOR SELECT TO authenticated USING (public.fn_fotos_pode_gerir(auth.uid()));
CREATE POLICY "fotos_buscas_log staff le" ON public.fotos_buscas_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Moderador pela tela só muda campos de moderação.
CREATE OR REPLACE FUNCTION public.fn_fotos_evento_proteger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF (NEW.evento_id, NEW.storage_path, NEW.storage_path_preview, NEW.origem, NEW.enviado_por, NEW.status_indexacao, NEW.qtd_rostos, NEW.alerta_moderacao, NEW.rotulos_moderacao)
       IS DISTINCT FROM (OLD.evento_id, OLD.storage_path, OLD.storage_path_preview, OLD.origem, OLD.enviado_por, OLD.status_indexacao, OLD.qtd_rostos, OLD.alerta_moderacao, OLD.rotulos_moderacao) THEN
      RAISE EXCEPTION 'campo_protegido';
    END IF;
    NEW.moderado_por := auth.uid();
    NEW.moderado_em := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fotos_evento_proteger BEFORE UPDATE ON public.fotos_evento FOR EACH ROW EXECUTE FUNCTION public.fn_fotos_evento_proteger();

-- Limite de 30 fotos por envio de convidado.
CREATE OR REPLACE FUNCTION public.fn_fotos_evento_limite_envio()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.envio_id IS NOT NULL AND (SELECT count(*) FROM public.fotos_evento WHERE envio_id = NEW.envio_id) >= 30 THEN
    RAISE EXCEPTION 'limite_30_fotos';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fotos_evento_limite_envio BEFORE INSERT ON public.fotos_evento FOR EACH ROW EXECUTE FUNCTION public.fn_fotos_evento_limite_envio();

-- Rate limit atômico por IP (hash) e ação, janela de 1 hora. Só o servidor chama.
CREATE OR REPLACE FUNCTION public.fn_fotos_rate_limit(p_ip_hash text, p_acao text, p_limite integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('fotos_rl:' || p_ip_hash || ':' || p_acao));
  DELETE FROM public.rate_limit_fotos_publico WHERE criado_em < now() - interval '2 hours';
  SELECT count(*) INTO n FROM public.rate_limit_fotos_publico
   WHERE ip_hash = p_ip_hash AND acao = p_acao AND criado_em > now() - interval '1 hour';
  IF n >= p_limite THEN RETURN false; END IF;
  INSERT INTO public.rate_limit_fotos_publico (ip_hash, acao) VALUES (p_ip_hash, p_acao);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.fn_fotos_rate_limit(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fotos_rate_limit(text, text, integer) TO service_role;

-- Lead reaproveitado pelo WhatsApp; aceites gravados com data e hora.
CREATE OR REPLACE FUNCTION public.fn_fotos_lead_registrar(p_evento uuid, p_nome text, p_whatsapp text, p_email text, p_biometria boolean, p_publicacao boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.leads_fotos (evento_id, nome, whatsapp, email, aceite_biometria, aceite_biometria_em, aceite_publicacao, aceite_publicacao_em)
  VALUES (p_evento, p_nome, p_whatsapp, nullif(p_email,''), coalesce(p_biometria,false), CASE WHEN p_biometria THEN now() END,
          coalesce(p_publicacao,false), CASE WHEN p_publicacao THEN now() END)
  ON CONFLICT (evento_id, whatsapp) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = coalesce(EXCLUDED.email, leads_fotos.email),
    aceite_biometria = leads_fotos.aceite_biometria OR EXCLUDED.aceite_biometria,
    aceite_biometria_em = CASE WHEN EXCLUDED.aceite_biometria THEN now() ELSE leads_fotos.aceite_biometria_em END,
    aceite_publicacao = leads_fotos.aceite_publicacao OR EXCLUDED.aceite_publicacao,
    aceite_publicacao_em = CASE WHEN EXCLUDED.aceite_publicacao THEN now() ELSE leads_fotos.aceite_publicacao_em END
  RETURNING id INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.fn_fotos_lead_registrar(uuid, text, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fotos_lead_registrar(uuid, text, text, text, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_fotos_lead_contar(p_lead uuid, p_buscas integer, p_encontradas integer, p_enviadas integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.leads_fotos SET qtd_buscas = qtd_buscas + p_buscas,
    qtd_fotos_encontradas = qtd_fotos_encontradas + p_encontradas,
    qtd_fotos_enviadas = qtd_fotos_enviadas + p_enviadas WHERE id = p_lead
$$;
REVOKE ALL ON FUNCTION public.fn_fotos_lead_contar(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fotos_lead_contar(uuid, integer, integer, integer) TO service_role;