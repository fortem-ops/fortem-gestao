ALTER TABLE public.treino_sessoes DROP CONSTRAINT treino_sessoes_variacao_check;

ALTER TABLE public.treino_sessoes
  ADD CONSTRAINT treino_sessoes_variacao_check
  CHECK (variacao ~ '^(T[1-8]|S[1-4]-T[1-8])$');