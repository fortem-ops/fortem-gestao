DROP POLICY IF EXISTS "Author or coord/admin can update treinos" ON public.treinos;
CREATE POLICY "Authenticated can update treinos"
ON public.treinos FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);