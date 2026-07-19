CREATE TABLE public.portal_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(endpoint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_push_subscriptions TO authenticated;
GRANT ALL ON public.portal_push_subscriptions TO service_role;

ALTER TABLE public.portal_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_own_push_subs" ON public.portal_push_subscriptions
  FOR ALL USING (aluno_id = public.fn_current_aluno_id());

CREATE POLICY "staff_read_push_subs" ON public.portal_push_subscriptions
  FOR SELECT USING (public.is_staff());

CREATE TABLE public.portal_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  gatilho text NOT NULL,
  title text NOT NULL,
  body text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  sucesso boolean NOT NULL DEFAULT true,
  erro_detalhe text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_push_log TO authenticated;
GRANT ALL ON public.portal_push_log TO service_role;

ALTER TABLE public.portal_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_push_log" ON public.portal_push_log FOR ALL USING (public.is_staff());