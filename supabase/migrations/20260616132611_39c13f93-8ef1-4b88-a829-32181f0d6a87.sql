
-- 1) Restrict student creation to coordinators/admins
DROP POLICY IF EXISTS "Authenticated users can insert alunos" ON public.alunos;
CREATE POLICY "Coord/admin can insert alunos"
  ON public.alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

-- 2) Allow new event type in agenda notifications log
ALTER TABLE public.agenda_notificacoes_log
  DROP CONSTRAINT IF EXISTS agenda_notificacoes_log_evento_check;
ALTER TABLE public.agenda_notificacoes_log
  ADD CONSTRAINT agenda_notificacoes_log_evento_check
  CHECK (evento = 'agendado' OR evento = 'cancelado' OR evento LIKE 'proximo_30min%');
