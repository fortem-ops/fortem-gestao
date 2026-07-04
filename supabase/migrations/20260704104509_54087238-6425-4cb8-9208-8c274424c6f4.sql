
CREATE TABLE public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  nome_contato text,
  ultima_mensagem text,
  ultima_mensagem_at timestamptz,
  nao_lidas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversas TO authenticated;
GRANT ALL ON public.whatsapp_conversas TO service_role;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin e coord gerenciam conversas whatsapp"
  ON public.whatsapp_conversas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  wamid text UNIQUE,
  direcao text NOT NULL CHECK (direcao IN ('enviada','recebida')),
  tipo text NOT NULL DEFAULT 'text',
  conteudo text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin e coord gerenciam mensagens whatsapp"
  ON public.whatsapp_mensagens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE INDEX idx_whatsapp_mensagens_conversa ON public.whatsapp_mensagens(conversa_id, created_at DESC);
CREATE INDEX idx_whatsapp_conversas_ultima ON public.whatsapp_conversas(ultima_mensagem_at DESC NULLS LAST);

CREATE TRIGGER trg_whatsapp_conversas_updated
  BEFORE UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_conversas REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
