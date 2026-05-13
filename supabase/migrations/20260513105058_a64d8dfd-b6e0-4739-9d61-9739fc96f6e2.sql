ALTER TABLE public.ponto_horarios_professor
ADD COLUMN IF NOT EXISTS frequencia_mensal smallint;

COMMENT ON COLUMN public.ponto_horarios_professor.frequencia_mensal IS 'Para sábados: 1,2,3 ou 4 (todos). NULL para demais dias.';