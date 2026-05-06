
-- ============ ENUMS ============
CREATE TYPE public.notif_categoria AS ENUM (
  'pauta_tecnica','reuniao','manutencao','administrativo','aluno',
  'financeiro','comercial','marketing','estrutura','equipamentos','emergencial','outro'
);
CREATE TYPE public.notif_prioridade AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.notif_tipo AS ENUM ('simples','solicitacao','reuniao','manutencao');
CREATE TYPE public.notif_status AS ENUM ('nao_visualizada','visualizada','em_andamento','respondida','concluida','arquivada');
CREATE TYPE public.notif_dest_status AS ENUM ('nao_visualizada','visualizada','em_andamento','respondida','concluida','arquivada');
CREATE TYPE public.notif_acao AS ENUM ('criada','editada','visualizada','respondida','status_alterado','arquivada','comentario','anexo');

-- ============ TABLES ============
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  categoria public.notif_categoria NOT NULL DEFAULT 'outro',
  categoria_custom_id uuid,
  prioridade public.notif_prioridade NOT NULL DEFAULT 'media',
  tipo public.notif_tipo NOT NULL DEFAULT 'simples',
  status public.notif_status NOT NULL DEFAULT 'nao_visualizada',
  criado_por uuid NOT NULL,
  prazo timestamptz,
  aluno_id uuid,
  reuniao_data timestamptz,
  reuniao_local text,
  agenda_id uuid,
  requer_confirmacao_leitura boolean NOT NULL DEFAULT false,
  enviar_whatsapp boolean NOT NULL DEFAULT false,
  enviar_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_criado_por ON public.notificacoes(criado_por);
CREATE INDEX idx_notif_aluno ON public.notificacoes(aluno_id);
CREATE INDEX idx_notif_created ON public.notificacoes(created_at DESC);

CREATE TABLE public.notificacao_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  visualizado_em timestamptz,
  status public.notif_dest_status NOT NULL DEFAULT 'nao_visualizada',
  assinatura_digital text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notificacao_id, usuario_id)
);
CREATE INDEX idx_notif_dest_user ON public.notificacao_destinatarios(usuario_id, status);
CREATE INDEX idx_notif_dest_notif ON public.notificacao_destinatarios(notificacao_id);

CREATE TABLE public.notificacao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  comentario text NOT NULL,
  anexo_url text,
  anexo_nome text,
  anexo_tipo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_coment_notif ON public.notificacao_comentarios(notificacao_id, created_at);

CREATE TABLE public.notificacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  usuario_id uuid,
  acao public.notif_acao NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_hist_notif ON public.notificacao_historico(notificacao_id, created_at);

CREATE TABLE public.notificacao_categorias_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cor text NOT NULL DEFAULT 'blue',
  criado_por uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ FUNCTION: pode ver notificação ============
CREATE OR REPLACE FUNCTION public.fn_user_can_see_notificacao(_notif_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_coordinator_or_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id = _notif_id AND n.criado_por = _user_id)
    OR EXISTS (SELECT 1 FROM public.notificacao_destinatarios d WHERE d.notificacao_id = _notif_id AND d.usuario_id = _user_id)
$$;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.trg_notif_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacao_historico (notificacao_id, usuario_id, acao, payload)
  VALUES (NEW.id, NEW.criado_por, 'criada', jsonb_build_object('titulo', NEW.titulo, 'tipo', NEW.tipo));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notif_after_insert
AFTER INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_notif_after_insert();

CREATE OR REPLACE FUNCTION public.trg_notif_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notificacao_historico (notificacao_id, usuario_id, acao, payload)
    VALUES (NEW.id, auth.uid(), 'status_alterado',
            jsonb_build_object('de', OLD.status, 'para', NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notif_before_update
BEFORE UPDATE ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_notif_status_change();

CREATE OR REPLACE FUNCTION public.trg_notif_dest_visualizado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.visualizado_em IS NULL AND NEW.visualizado_em IS NOT NULL THEN
    INSERT INTO public.notificacao_historico (notificacao_id, usuario_id, acao, payload)
    VALUES (NEW.notificacao_id, NEW.usuario_id, 'visualizada', '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notif_dest_visualizado
AFTER UPDATE ON public.notificacao_destinatarios
FOR EACH ROW EXECUTE FUNCTION public.trg_notif_dest_visualizado();

CREATE OR REPLACE FUNCTION public.trg_notif_coment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacao_historico (notificacao_id, usuario_id, acao, payload)
  VALUES (NEW.notificacao_id, NEW.usuario_id,
          CASE WHEN NEW.anexo_url IS NOT NULL THEN 'anexo'::notif_acao ELSE 'comentario'::notif_acao END,
          jsonb_build_object('preview', left(NEW.comentario, 80)));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notif_coment_insert
AFTER INSERT ON public.notificacao_comentarios
FOR EACH ROW EXECUTE FUNCTION public.trg_notif_coment_insert();

-- ============ RLS ============
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_categorias_custom ENABLE ROW LEVEL SECURITY;

-- notificacoes
CREATE POLICY "View notificacoes" ON public.notificacoes FOR SELECT TO authenticated
USING (public.fn_user_can_see_notificacao(id, auth.uid()));

CREATE POLICY "Insert own notificacoes" ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Update own or coord/admin" ON public.notificacoes FOR UPDATE TO authenticated
USING (criado_por = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin delete notificacoes" ON public.notificacoes FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- destinatarios
CREATE POLICY "View dest" ON public.notificacao_destinatarios FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id = notificacao_id AND n.criado_por = auth.uid())
);

CREATE POLICY "Insert dest by criador or coord" ON public.notificacao_destinatarios FOR INSERT TO authenticated
WITH CHECK (
  public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id = notificacao_id AND n.criado_por = auth.uid())
);

CREATE POLICY "Update own dest or criador/coord" ON public.notificacao_destinatarios FOR UPDATE TO authenticated
USING (
  usuario_id = auth.uid()
  OR public.is_coordinator_or_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id = notificacao_id AND n.criado_por = auth.uid())
);

CREATE POLICY "Delete dest by criador or admin" ON public.notificacao_destinatarios FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id = notificacao_id AND n.criado_por = auth.uid())
);

-- comentarios
CREATE POLICY "View comentarios" ON public.notificacao_comentarios FOR SELECT TO authenticated
USING (public.fn_user_can_see_notificacao(notificacao_id, auth.uid()));

CREATE POLICY "Insert comentarios" ON public.notificacao_comentarios FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND public.fn_user_can_see_notificacao(notificacao_id, auth.uid())
);

CREATE POLICY "Admin delete comentarios" ON public.notificacao_comentarios FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR usuario_id = auth.uid());

-- historico
CREATE POLICY "View historico" ON public.notificacao_historico FOR SELECT TO authenticated
USING (public.fn_user_can_see_notificacao(notificacao_id, auth.uid()));

-- categorias custom
CREATE POLICY "View categorias custom" ON public.notificacao_categorias_custom FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage categorias custom" ON public.notificacao_categorias_custom FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('notificacao-anexos', 'notificacao-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload notif anexos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notificacao-anexos');

CREATE POLICY "Authenticated read notif anexos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notificacao-anexos');

CREATE POLICY "Owner delete notif anexos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'notificacao-anexos' AND owner = auth.uid());

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacao_destinatarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacao_comentarios;

ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
ALTER TABLE public.notificacao_destinatarios REPLICA IDENTITY FULL;
ALTER TABLE public.notificacao_comentarios REPLICA IDENTITY FULL;
