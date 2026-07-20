INSERT INTO public.clube_fortem_membros (aluno_id, nivel_membro, status_membro, aluno_desde)
SELECT 
  cp.aluno_id,
  CASE cp.nivel
    WHEN 'elite'        THEN 'max'::clube_nivel_membro
    WHEN 'comprometido' THEN 'pro'::clube_nivel_membro
    WHEN 'dedicado'     THEN 'power'::clube_nivel_membro
    ELSE                     'start'::clube_nivel_membro
  END,
  'ativo',
  COALESCE(
    (SELECT MIN(data_inicio) FROM planos WHERE aluno_id = cp.aluno_id),
    now()
  )
FROM clube_pontos cp
WHERE NOT EXISTS (
  SELECT 1 FROM clube_fortem_membros cfm WHERE cfm.aluno_id = cp.aluno_id
)
ON CONFLICT (aluno_id) DO NOTHING;