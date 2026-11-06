DROP POLICY "staff le ciclos recovery" ON public.recovery_mensal_ciclos;
CREATE POLICY "staff ou proprio le ciclos recovery" ON public.recovery_mensal_ciclos FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid())
         OR aluno_id IN (SELECT a.id FROM public.alunos a WHERE a.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_recovery_mensal_meu()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aluno uuid; rc record; v_saldo int; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT a.id INTO v_aluno FROM public.alunos a WHERE a.user_id = auth.uid() LIMIT 1;
  IF v_aluno IS NULL THEN RETURN jsonb_build_object('ativo', false); END IF;
  SELECT * INTO rc FROM public.recovery_mensal_ciclos
   WHERE aluno_id = v_aluno AND competencia <= v_hoje AND validade >= v_hoje
   ORDER BY competencia DESC LIMIT 1;
  IF rc IS NULL THEN RETURN jsonb_build_object('ativo', false); END IF;
  SELECT GREATEST(quantidade_inicial - quantidade_usada, 0) INTO v_saldo FROM public.creditos_aluno WHERE id = rc.credito_id AND ativo;
  RETURN jsonb_build_object('ativo', true, 'total', 4, 'saldo', COALESCE(v_saldo, 0), 'renova_em', rc.validade + 1);
END $$;