
-- Dedupe Corrida bases (manter o mais recente por nome)
DELETE FROM public.banco_treinos_personalizados a
USING public.banco_treinos_personalizados b
WHERE a.nome ILIKE 'Corrida %'
  AND b.nome = a.nome
  AND b.updated_at > a.updated_at;

-- Índice único parcial: 1 base por fase de Corrida
CREATE UNIQUE INDEX IF NOT EXISTS idx_banco_treinos_personalizados_corrida_unico
  ON public.banco_treinos_personalizados ((lower(nome)))
  WHERE nome ILIKE 'Corrida %';

-- Substituir policies de INSERT/UPDATE/DELETE para tratar Corrida como base coord/admin
DROP POLICY IF EXISTS "Authenticated can insert own personalizados" ON public.banco_treinos_personalizados;
DROP POLICY IF EXISTS "Author or coord/admin can update personalizados" ON public.banco_treinos_personalizados;
DROP POLICY IF EXISTS "Author or coord/admin can delete personalizados" ON public.banco_treinos_personalizados;

CREATE POLICY "Insert personalizados (Corrida só coord/admin)"
  ON public.banco_treinos_personalizados
  FOR INSERT
  WITH CHECK (
    auth.uid() = criado_por
    AND (
      nome NOT ILIKE 'Corrida %'
      OR public.is_coordinator_or_admin(auth.uid())
    )
  );

CREATE POLICY "Update personalizados (Corrida só coord/admin)"
  ON public.banco_treinos_personalizados
  FOR UPDATE
  USING (
    CASE
      WHEN nome ILIKE 'Corrida %' THEN public.is_coordinator_or_admin(auth.uid())
      ELSE (auth.uid() = criado_por OR public.is_coordinator_or_admin(auth.uid()))
    END
  );

CREATE POLICY "Delete personalizados (Corrida só coord/admin)"
  ON public.banco_treinos_personalizados
  FOR DELETE
  USING (
    CASE
      WHEN nome ILIKE 'Corrida %' THEN public.is_coordinator_or_admin(auth.uid())
      ELSE (auth.uid() = criado_por OR public.is_coordinator_or_admin(auth.uid()))
    END
  );
