
-- Enum para tipo de acordo
CREATE TYPE public.tipo_acordo_intervalo AS ENUM ('estendido_2h', 'reduzido_30min');

-- Tabela de acordos
CREATE TABLE public.ponto_acordos_intervalo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  tipo public.tipo_acordo_intervalo NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  documento_url TEXT,
  documento_path TEXT,
  aceite_digital_em TIMESTAMPTZ,
  aceite_ip TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acordos_intervalo_usuario ON public.ponto_acordos_intervalo(usuario_id);
CREATE INDEX idx_acordos_intervalo_vigencia ON public.ponto_acordos_intervalo(vigencia_inicio, vigencia_fim);

ALTER TABLE public.ponto_acordos_intervalo ENABLE ROW LEVEL SECURITY;

-- Trigger validação de vigência
CREATE OR REPLACE FUNCTION public.fn_validar_acordo_intervalo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vigencia_fim IS NOT NULL AND NEW.vigencia_fim < NEW.vigencia_inicio THEN
    RAISE EXCEPTION 'Vigência final não pode ser anterior à inicial';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_acordo_intervalo
BEFORE INSERT OR UPDATE ON public.ponto_acordos_intervalo
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_acordo_intervalo();

CREATE TRIGGER trg_acordos_intervalo_updated
BEFORE UPDATE ON public.ponto_acordos_intervalo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
CREATE POLICY "Dono vê próprios acordos"
ON public.ponto_acordos_intervalo FOR SELECT
USING (usuario_id = auth.uid());

CREATE POLICY "Admin/coord veem todos acordos"
ON public.ponto_acordos_intervalo FOR SELECT
USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin/coord criam acordos"
ON public.ponto_acordos_intervalo FOR INSERT
WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin/coord editam acordos"
ON public.ponto_acordos_intervalo FOR UPDATE
USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Dono registra aceite digital"
ON public.ponto_acordos_intervalo FOR UPDATE
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Admin/coord removem acordos"
ON public.ponto_acordos_intervalo FOR DELETE
USING (public.is_coordinator_or_admin(auth.uid()));

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('acordos-intervalo', 'acordos-intervalo', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path layout: {usuario_id}/{filename})
CREATE POLICY "Dono lê próprios PDFs de acordo"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'acordos-intervalo'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admin/coord leem PDFs de acordo"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'acordos-intervalo'
  AND public.is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "Admin/coord enviam PDFs de acordo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'acordos-intervalo'
  AND public.is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "Admin/coord atualizam PDFs de acordo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'acordos-intervalo'
  AND public.is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "Admin/coord removem PDFs de acordo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'acordos-intervalo'
  AND public.is_coordinator_or_admin(auth.uid())
);

-- Função utilitária: acordo vigente
CREATE OR REPLACE FUNCTION public.fn_acordo_intervalo_vigente(_usuario UUID, _data DATE)
RETURNS public.tipo_acordo_intervalo
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tipo
  FROM public.ponto_acordos_intervalo
  WHERE usuario_id = _usuario
    AND ativo = true
    AND aceite_digital_em IS NOT NULL
    AND vigencia_inicio <= _data
    AND (vigencia_fim IS NULL OR vigencia_fim >= _data)
  ORDER BY vigencia_inicio DESC
  LIMIT 1
$$;
