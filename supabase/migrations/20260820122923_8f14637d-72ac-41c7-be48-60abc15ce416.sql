DROP POLICY IF EXISTS "Admin can insert bodymap shapes" ON public.bodymap_shapes;
DROP POLICY IF EXISTS "Admin can update bodymap shapes" ON public.bodymap_shapes;
DROP POLICY IF EXISTS "Admin can delete bodymap shapes" ON public.bodymap_shapes;

CREATE POLICY "Admin/coord can insert bodymap shapes" ON public.bodymap_shapes
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE POLICY "Admin/coord can update bodymap shapes" ON public.bodymap_shapes
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE POLICY "Admin/coord can delete bodymap shapes" ON public.bodymap_shapes
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));