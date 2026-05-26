
-- Helper: is_staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  )
$$;

-- alunos
DROP POLICY IF EXISTS "Authenticated users can view alunos" ON public.alunos;
CREATE POLICY "Staff or owner can view alunos"
ON public.alunos FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR user_id = auth.uid()
  OR responsavel_id = auth.uid()
);

-- clube_fortem_membros
DROP POLICY IF EXISTS "Authenticated can view membros" ON public.clube_fortem_membros;
CREATE POLICY "Staff or member can view membros"
ON public.clube_fortem_membros FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR aluno_id = public.fn_current_aluno_id()
);

-- cobranca_tentativas
DROP POLICY IF EXISTS "view_cob" ON public.cobranca_tentativas;
CREATE POLICY "Coord/admin can view cob"
ON public.cobranca_tentativas FOR SELECT TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()));

-- consumo_servicos
DROP POLICY IF EXISTS "Authenticated users can view consumo" ON public.consumo_servicos;
CREATE POLICY "Staff or owner can view consumo"
ON public.consumo_servicos FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR aluno_id = public.fn_current_aluno_id()
);

-- pagamentos
DROP POLICY IF EXISTS "view_pag" ON public.pagamentos;
CREATE POLICY "Staff or owner can view pagamentos"
ON public.pagamentos FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR aluno_id = public.fn_current_aluno_id()
);

-- pagamento_parcelas (via parent pagamento)
DROP POLICY IF EXISTS "view_par" ON public.pagamento_parcelas;
CREATE POLICY "Staff or owner can view parcelas"
ON public.pagamento_parcelas FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.pagamentos p
    WHERE p.id = pagamento_parcelas.pagamento_id
      AND p.aluno_id = public.fn_current_aluno_id()
  )
);

-- planos
DROP POLICY IF EXISTS "Authenticated users can view planos" ON public.planos;
CREATE POLICY "Staff or owner can view planos"
ON public.planos FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR aluno_id = public.fn_current_aluno_id()
);

-- uploads
DROP POLICY IF EXISTS "Authenticated users can view uploads" ON public.uploads;
CREATE POLICY "Staff or owner can view uploads"
ON public.uploads FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR aluno_id = public.fn_current_aluno_id()
);

-- treinos: remove anon public read; restrict update to author or coord/admin
DROP POLICY IF EXISTS "Public can view treinos" ON public.treinos;
DROP POLICY IF EXISTS "Authenticated can update treinos" ON public.treinos;
CREATE POLICY "Author or coord/admin can update treinos"
ON public.treinos FOR UPDATE TO authenticated
USING (auth.uid() = autor_id OR public.is_coordinator_or_admin(auth.uid()))
WITH CHECK (auth.uid() = autor_id OR public.is_coordinator_or_admin(auth.uid()));
