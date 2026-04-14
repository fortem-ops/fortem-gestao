-- Allow coord/admin to update consumo_servicos
CREATE POLICY "Coord/admin can update consumo"
ON public.consumo_servicos
FOR UPDATE
TO authenticated
USING (is_coordinator_or_admin(auth.uid()));
