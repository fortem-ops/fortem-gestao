-- Cliente desde manual. Rollback: scripts/alunos-aluno-desde.rollback.sql
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS aluno_desde date;
COMMENT ON COLUMN public.alunos.aluno_desde IS 'Data manual de cliente desde; usada quando não há plano com data_inicio. Se houver plano, prevalece o menor planos.data_inicio.';