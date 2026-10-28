ALTER TABLE public.msg_modelos ADD COLUMN botao_tipo text NOT NULL DEFAULT 'nenhum' CHECK (botao_tipo IN ('nenhum','url_fixa'));
ALTER TABLE public.msg_modelos ADD COLUMN botao_texto text;
ALTER TABLE public.msg_modelos ADD COLUMN botao_url text;
UPDATE public.msg_modelos SET botao_tipo='url_fixa', botao_texto='Visit website', botao_url='https://soufortem.com.br/10anos' WHERE meta_nome='convite_festa_10_anos';

CREATE TABLE public.msg_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  canal text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','email','push')),
  modelo_id uuid REFERENCES public.msg_modelos(id),
  filtro jsonb NOT NULL DEFAULT '{}'::jsonb,
  selecao jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pronta','enviando','pausada','concluida','cancelada')),
  agendado_para timestamptz,
  criado_por uuid DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_campanhas TO authenticated;
GRANT ALL ON public.msg_campanhas TO service_role;
ALTER TABLE public.msg_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_campanhas admin select" ON public.msg_campanhas FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_campanhas admin insert" ON public.msg_campanhas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_campanhas admin update" ON public.msg_campanhas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_campanhas admin delete" ON public.msg_campanhas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.fn_msg_campanhas_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_msg_campanhas_touch BEFORE UPDATE ON public.msg_campanhas FOR EACH ROW EXECUTE FUNCTION public.fn_msg_campanhas_touch();

CREATE TABLE public.msg_campanha_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.msg_campanhas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL,
  canal text NOT NULL,
  nome text,
  telefone_norm text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','enviado','falhou','ignorado')),
  erro text,
  wa_message_id text,
  enviado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, aluno_id, canal)
);
CREATE UNIQUE INDEX msg_camp_dest_tel_uq ON public.msg_campanha_destinatarios (campanha_id, telefone_norm) WHERE canal = 'whatsapp';
CREATE INDEX msg_camp_dest_status_idx ON public.msg_campanha_destinatarios (campanha_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_campanha_destinatarios TO authenticated;
GRANT ALL ON public.msg_campanha_destinatarios TO service_role;
ALTER TABLE public.msg_campanha_destinatarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_camp_dest admin select" ON public.msg_campanha_destinatarios FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_camp_dest admin insert" ON public.msg_campanha_destinatarios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_camp_dest admin update" ON public.msg_campanha_destinatarios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_camp_dest admin delete" ON public.msg_campanha_destinatarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.msg_testes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid REFERENCES public.msg_modelos(id) ON DELETE SET NULL,
  telefone_norm text,
  nome_teste text,
  status text NOT NULL CHECK (status IN ('enviado','falhou')),
  erro text,
  wa_message_id text,
  criado_por uuid DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX msg_testes_user_idx ON public.msg_testes (criado_por, criado_em);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_testes TO authenticated;
GRANT ALL ON public.msg_testes TO service_role;
ALTER TABLE public.msg_testes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_testes admin select" ON public.msg_testes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_testes admin insert" ON public.msg_testes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_testes admin update" ON public.msg_testes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_testes admin delete" ON public.msg_testes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));