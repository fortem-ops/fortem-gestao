DROP POLICY IF EXISTS "Staff or creator can view personalizados" ON public.banco_treinos_personalizados;

CREATE POLICY "Staff or creator can view personalizados"
ON public.banco_treinos_personalizados
FOR SELECT TO authenticated
USING (public.is_staff() OR criado_por = auth.uid());