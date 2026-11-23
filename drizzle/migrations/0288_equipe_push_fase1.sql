CREATE TABLE public.equipe_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX equipe_push_subscriptions_user_idx ON public.equipe_push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_push_subscriptions TO authenticated;
GRANT ALL ON public.equipe_push_subscriptions TO service_role;
ALTER TABLE public.equipe_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe push: le as proprias ou admin" ON public.equipe_push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "equipe push: staff inscreve a si" ON public.equipe_push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "equipe push: atualiza as proprias" ON public.equipe_push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "equipe push: apaga as proprias" ON public.equipe_push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.equipe_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gatilho text NOT NULL,
  titulo text NOT NULL,
  corpo text NOT NULL DEFAULT '',
  url text,
  referencia text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','enviado','sem_inscricao','falha')),
  sucesso boolean NOT NULL DEFAULT false,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  enviar_apos timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz
);
CREATE UNIQUE INDEX equipe_push_log_dedup ON public.equipe_push_log(gatilho, referencia, user_id);
CREATE INDEX equipe_push_log_pendentes ON public.equipe_push_log(enviar_apos) WHERE status = 'pendente';
GRANT SELECT ON public.equipe_push_log TO authenticated;
GRANT ALL ON public.equipe_push_log TO service_role;
ALTER TABLE public.equipe_push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe push log: admin le" ON public.equipe_push_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

SELECT cron.schedule('equipe-push-pendentes', '10 9 * * 1-5',
  $$ SELECT public.fn_call_edge_function('send-push-equipe', '{"acao":"enviar_pendentes"}'::jsonb); $$);