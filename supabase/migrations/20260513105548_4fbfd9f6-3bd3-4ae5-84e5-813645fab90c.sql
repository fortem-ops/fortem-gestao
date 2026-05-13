ALTER TABLE public.ponto_horarios_professor
DROP CONSTRAINT IF EXISTS ponto_horarios_professor_intervalo_min_check;

ALTER TABLE public.ponto_horarios_professor
ADD CONSTRAINT ponto_horarios_professor_intervalo_min_check
CHECK (intervalo_min IN (0, 15, 60));