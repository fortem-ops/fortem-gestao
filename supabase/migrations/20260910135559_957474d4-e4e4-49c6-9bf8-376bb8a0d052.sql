DROP POLICY IF EXISTS avaliacoes_delete ON public.avaliacoes;
CREATE POLICY avaliacoes_delete ON public.avaliacoes FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));