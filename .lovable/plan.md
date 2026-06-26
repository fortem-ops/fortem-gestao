## Problema

A constraint `ponto_horarios_professor_check1` exige `horario_inicio >= 06:00`, então qualquer valor entre 05:00–05:59 é rejeitado pelo banco.

## Correção

Migração para relaxar o limite inferior do check para 05:00:

```sql
ALTER TABLE public.ponto_horarios_professor
  DROP CONSTRAINT ponto_horarios_professor_check1;

ALTER TABLE public.ponto_horarios_professor
  ADD CONSTRAINT ponto_horarios_professor_check1
  CHECK (horario_inicio >= '05:00:00'::time AND horario_fim <= '21:15:00'::time);
```

Nenhuma mudança de código adicional — o seletor já oferece 05:00–05:45.