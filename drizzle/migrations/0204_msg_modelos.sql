CREATE TABLE public.msg_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('email','whatsapp')),
  meta_nome text,
  idioma text NOT NULL DEFAULT 'pt_BR',
  categoria text CHECK (categoria IS NULL OR categoria IN ('MARKETING','UTILITY')),
  texto text,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  assunto text,
  corpo_html text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','a_cadastrar','aprovado')),
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_modelos TO authenticated;
GRANT ALL ON public.msg_modelos TO service_role;
ALTER TABLE public.msg_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_modelos admin select" ON public.msg_modelos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_modelos admin insert" ON public.msg_modelos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_modelos admin update" ON public.msg_modelos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_modelos admin delete" ON public.msg_modelos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.fn_msg_modelos_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_msg_modelos_touch BEFORE UPDATE ON public.msg_modelos FOR EACH ROW EXECUTE FUNCTION public.fn_msg_modelos_touch();