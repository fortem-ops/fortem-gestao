
-- 1. Tipos de avaliação
CREATE TABLE IF NOT EXISTS public.avaliacao_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  engine text NOT NULL DEFAULT 'dinamico' CHECK (engine IN ('dinamico','funcional_fixo','composicao_pollock')),
  icone text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  is_sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacao_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read avaliacao_tipos"
  ON public.avaliacao_tipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/Admin manage avaliacao_tipos"
  ON public.avaliacao_tipos FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_avaliacao_tipos_updated_at
  BEFORE UPDATE ON public.avaliacao_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Protege tipos do sistema contra exclusão
CREATE OR REPLACE FUNCTION public.protect_sistema_tipos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_sistema THEN
    RAISE EXCEPTION 'Tipos de avaliação do sistema não podem ser excluídos';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_protect_sistema_tipos
  BEFORE DELETE ON public.avaliacao_tipos
  FOR EACH ROW EXECUTE FUNCTION public.protect_sistema_tipos();

-- 2. Protocolos
CREATE TABLE IF NOT EXISTS public.avaliacao_protocolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid NOT NULL REFERENCES public.avaliacao_tipos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_id, nome)
);

ALTER TABLE public.avaliacao_protocolos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read avaliacao_protocolos"
  ON public.avaliacao_protocolos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/Admin manage avaliacao_protocolos"
  ON public.avaliacao_protocolos FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_avaliacao_protocolos_updated_at
  BEFORE UPDATE ON public.avaliacao_protocolos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garante apenas 1 default por tipo
CREATE OR REPLACE FUNCTION public.enforce_single_default_protocolo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.avaliacao_protocolos
       SET is_default = false
     WHERE tipo_id = NEW.tipo_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_protocolo
  AFTER INSERT OR UPDATE OF is_default ON public.avaliacao_protocolos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_protocolo();

-- 3. Vínculo em avaliacoes
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS protocolo_id uuid REFERENCES public.avaliacao_protocolos(id) ON DELETE SET NULL;

-- 4. Seed dos 5 tipos sistema
INSERT INTO public.avaliacao_tipos (slug, nome, engine, ordem, is_sistema) VALUES
  ('funcional',           'Funcional',           'funcional_fixo',     1, true),
  ('composicao_corporal', 'Composição Corporal', 'composicao_pollock', 2, true),
  ('pliometria',          'Pliometria',          'dinamico',           3, true),
  ('forca',               'Força',               'dinamico',           4, true),
  ('experimental',        'Experimental',        'dinamico',           5, true)
ON CONFLICT (slug) DO NOTHING;

-- 5. Protocolos padrão para cada tipo sistema
INSERT INTO public.avaliacao_protocolos (tipo_id, nome, descricao, schema, is_default, ordem)
SELECT t.id, 'Padrão', 'Protocolo padrão do tipo', '{}'::jsonb, true, 0
FROM public.avaliacao_tipos t
WHERE t.is_sistema
  AND NOT EXISTS (SELECT 1 FROM public.avaliacao_protocolos p WHERE p.tipo_id = t.id);

-- 6. Migra schema existente do avaliacao_templates (tipo='experimental') para o protocolo padrão de Experimental
DO $$
DECLARE
  v_schema jsonb;
  v_proto_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='avaliacao_templates') THEN
    SELECT schema INTO v_schema FROM public.avaliacao_templates WHERE tipo = 'experimental' LIMIT 1;
    IF v_schema IS NOT NULL THEN
      SELECT p.id INTO v_proto_id
        FROM public.avaliacao_protocolos p
        JOIN public.avaliacao_tipos t ON t.id = p.tipo_id
       WHERE t.slug = 'experimental' AND p.is_default
       LIMIT 1;
      IF v_proto_id IS NOT NULL THEN
        UPDATE public.avaliacao_protocolos SET schema = v_schema WHERE id = v_proto_id;
      END IF;
    END IF;
  END IF;
END $$;
