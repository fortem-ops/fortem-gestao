
CREATE TABLE public.aluno_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX aluno_calendar_tokens_aluno_id_key ON public.aluno_calendar_tokens(aluno_id);
CREATE INDEX aluno_calendar_tokens_token_idx ON public.aluno_calendar_tokens(token);

GRANT SELECT, INSERT ON public.aluno_calendar_tokens TO authenticated;
GRANT ALL ON public.aluno_calendar_tokens TO service_role;

ALTER TABLE public.aluno_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_read_own_token"
  ON public.aluno_calendar_tokens FOR SELECT
  TO authenticated
  USING (public.aluno_user_id(aluno_id) = auth.uid());

CREATE POLICY "aluno_insert_own_token"
  ON public.aluno_calendar_tokens FOR INSERT
  TO authenticated
  WITH CHECK (public.aluno_user_id(aluno_id) = auth.uid());
