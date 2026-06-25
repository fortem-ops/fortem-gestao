ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_frequencia_semanal_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_frequencia_semanal_check
  CHECK (frequencia_semanal IN (1, 2, 3, 5));

UPDATE public.contratos c
SET
  frequencia_semanal = 5,
  creditos_total = CASE vigencia_tipo
    WHEN 'mensal' THEN 20
    WHEN 'anual'  THEN 260
  END
FROM public.alunos a
WHERE a.id = c.aluno_id
  AND a.frequencia_semanal = 5
  AND c.observacoes LIKE 'Importado jun/2026%';