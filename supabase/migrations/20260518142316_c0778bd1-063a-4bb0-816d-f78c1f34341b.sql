
CREATE TABLE public.notificacao_email_config (
  id integer PRIMARY KEY DEFAULT 1,
  remetente_nome text NOT NULL DEFAULT 'FORTEM',
  remetente_email text NOT NULL DEFAULT 'contatofortem@gmail.com',
  atividades_monitoradas text[] NOT NULL DEFAULT ARRAY['Treino Experimental','Avaliação Funcional']::text[],
  enviar_em_agendamento boolean NOT NULL DEFAULT true,
  enviar_em_cancelamento boolean NOT NULL DEFAULT true,
  exigir_aluno_vinculado boolean NOT NULL DEFAULT true,
  destinatarios_regra text NOT NULL DEFAULT 'profissional_vinculado',
  emails_extras text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT notificacao_email_config_single_row CHECK (id = 1),
  CONSTRAINT notificacao_email_config_regra_check CHECK (destinatarios_regra IN (
    'profissional_vinculado',
    'profissional_e_coordenadores',
    'profissional_coord_admin',
    'todos_staff'
  ))
);

ALTER TABLE public.notificacao_email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email config"
  ON public.notificacao_email_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin can update email config"
  ON public.notificacao_email_config FOR UPDATE TO authenticated
  USING (is_coordinator_or_admin(auth.uid()))
  WITH CHECK (is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_notificacao_email_config_updated
  BEFORE UPDATE ON public.notificacao_email_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notificacao_email_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;
