
-- 1) Tabela de presenças por ocorrência de aula
CREATE TABLE public.agenda_presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.agenda_servicos(id) ON DELETE CASCADE,
  data date NOT NULL,
  comparecimento boolean NOT NULL,
  marcado_por uuid NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agenda_id, data)
);

CREATE INDEX idx_agenda_presencas_data ON public.agenda_presencas(data);
CREATE INDEX idx_agenda_presencas_agenda ON public.agenda_presencas(agenda_id);

ALTER TABLE public.agenda_presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view presencas"
  ON public.agenda_presencas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner or coord/admin can insert presencas"
  ON public.agenda_presencas FOR INSERT
  TO authenticated
  WITH CHECK (
    marcado_por = auth.uid() AND (
      is_coordinator_or_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.agenda_servicos a
        WHERE a.id = agenda_presencas.agenda_id AND a.profissional_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner or coord/admin can update presencas"
  ON public.agenda_presencas FOR UPDATE
  TO authenticated
  USING (
    is_coordinator_or_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.agenda_servicos a
      WHERE a.id = agenda_presencas.agenda_id AND a.profissional_id = auth.uid()
    )
  );

CREATE POLICY "Coord/admin can delete presencas"
  ON public.agenda_presencas FOR DELETE
  TO authenticated
  USING (is_coordinator_or_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER trg_agenda_presencas_updated_at
BEFORE UPDATE ON public.agenda_presencas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Atualiza a view de relatórios para usar agenda_presencas
DROP VIEW IF EXISTS public.v_servicos_agenda;

CREATE VIEW public.v_servicos_agenda AS
SELECT
  ag.id AS agenda_id,
  ag.tipo,
  ag.atividade,
  ag.local,
  ag.dia_semana,
  ag.horario_inicio,
  ag.horario_fim,
  ag.data_especifica,
  ag.profissional_id,
  pr.full_name AS profissional_nome,
  ag.aluno_id,
  a.nome AS aluno_nome,
  -- Para avulsos: lê presença daquela data específica
  -- Para fixos: true se houver ao menos uma presença marcada como true (informativo)
  COALESCE(
    (SELECT p.comparecimento
       FROM public.agenda_presencas p
      WHERE p.agenda_id = ag.id
        AND (ag.tipo <> 'avulso' OR p.data = ag.data_especifica)
      ORDER BY p.data DESC
      LIMIT 1),
    false
  ) AS comparecimento,
  EXISTS (
    SELECT 1 FROM public.agenda_presencas p
    WHERE p.agenda_id = ag.id
      AND (ag.tipo <> 'avulso' OR p.data = ag.data_especifica)
  ) AS presenca_marcada
FROM public.agenda_servicos ag
LEFT JOIN public.profiles pr ON pr.user_id = ag.profissional_id
LEFT JOIN public.alunos a ON a.id = ag.aluno_id;
