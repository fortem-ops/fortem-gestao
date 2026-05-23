
-- Enum tipo de vínculo
DO $$ BEGIN
  CREATE TYPE public.tipo_vinculo_trabalhista AS ENUM (
    'horista', 'mensalista', 'pj', 'estagiario', 'autonomo', 'coordenador_gestao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cadastro_trabalhista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  tipo_vinculo public.tipo_vinculo_trabalhista NOT NULL DEFAULT 'mensalista',
  valor_hora_aula numeric(10,2) DEFAULT 0,
  carga_horaria_semanal_min integer DEFAULT 2200, -- ~36h40
  limite_diario_min integer DEFAULT 480, -- 8h
  banco_horas_ativo boolean NOT NULL DEFAULT false,
  elegivel_ponto boolean NOT NULL DEFAULT true,
  art_62_clt boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cadastro_trabalhista ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam cadastro trabalhista"
ON public.cadastro_trabalhista
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Usuário vê seu próprio cadastro trabalhista"
ON public.cadastro_trabalhista
FOR SELECT
TO authenticated
USING (usuario_id = auth.uid());

CREATE POLICY "Coordenadores veem cadastros"
ON public.cadastro_trabalhista
FOR SELECT
TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_cadastro_trabalhista_updated
BEFORE UPDATE ON public.cadastro_trabalhista
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
