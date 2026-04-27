-- Tabela de horários de trabalho por dia da semana, por professor
CREATE TABLE public.ponto_horarios_professor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 6), -- 1=segunda ... 6=sábado
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  intervalo_min smallint NOT NULL DEFAULT 0 CHECK (intervalo_min IN (0, 15)),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, dia_semana),
  CHECK (horario_fim > horario_inicio),
  CHECK (horario_inicio >= '06:00' AND horario_fim <= '21:15')
);

CREATE INDEX idx_ponto_horarios_usuario ON public.ponto_horarios_professor(usuario_id);

ALTER TABLE public.ponto_horarios_professor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Próprio ou coord/admin vê horários"
  ON public.ponto_horarios_professor FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin gerencia horários"
  ON public.ponto_horarios_professor FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_ponto_horarios_updated_at
  BEFORE UPDATE ON public.ponto_horarios_professor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();