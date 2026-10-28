-- Rollback da migração 0210 (alunos.aluno_desde). Só rodar se a coluna ainda não tiver dados que importem.
ALTER TABLE public.alunos DROP COLUMN IF EXISTS aluno_desde;
