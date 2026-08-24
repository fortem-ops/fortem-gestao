CREATE POLICY "Nutri/fisio can insert clientes avulsos"
ON public.alunos
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'avulso'
  AND (
    public.has_role(auth.uid(), 'nutricionista')
    OR public.has_role(auth.uid(), 'fisioterapeuta')
  )
);