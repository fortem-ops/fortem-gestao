CREATE OR REPLACE FUNCTION public.fn_semestral_elegivel(p_aluno uuid, p_codigo text, p_hoje date DEFAULT NULL, p_ignorar_cpf boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.planos_catalogo;
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_well boolean; v_total boolean; v_agr text; v_hash text; v_usado boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE codigo = p_codigo;
  IF NOT FOUND OR c.agregadora_requerida IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Item não é do Plano Semestral de agregadora.');
  END IF;
  SELECT bool_or(tipo = 'Gympass/Wellhub'), bool_or(tipo = 'Total Pass') INTO v_well, v_total
  FROM public.planos WHERE aluno_id = p_aluno AND ativo;
  v_well := COALESCE(v_well, false); v_total := COALESCE(v_total, false);
  IF v_well AND v_total THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Aluno com Wellhub e TotalPass ativos ao mesmo tempo: a equipe precisa corrigir o cadastro.');
  END IF;
  v_agr := CASE WHEN v_well THEN 'wellhub' WHEN v_total THEN 'totalpass' END;
  IF v_agr IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Aluno sem plano de agregadora ativo.');
  END IF;
  IF v_agr <> c.agregadora_requerida THEN
    RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Este item é de outra agregadora.');
  END IF;
  IF c.vendavel_ate IS NOT NULL AND v_hoje > c.vendavel_ate THEN
    RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Promoção encerrada em ' || to_char(c.vendavel_ate, 'DD/MM/YYYY') || '.');
  END IF;
  IF NOT p_ignorar_cpf THEN
    SELECT cpf_hash INTO v_hash FROM public.alunos WHERE id = p_aluno;
    SELECT EXISTS (
      WITH alunos_cpf AS (
        SELECT id FROM public.alunos WHERE id = p_aluno OR (v_hash IS NOT NULL AND cpf_hash = v_hash)
      ), itens AS (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027')
      SELECT 1 FROM public.vendas WHERE aluno_id IN (SELECT id FROM alunos_cpf) AND catalogo_id IN (SELECT id FROM itens)
      UNION ALL SELECT 1 FROM public.planos WHERE aluno_id IN (SELECT id FROM alunos_cpf) AND catalogo_id IN (SELECT id FROM itens)
      UNION ALL SELECT 1 FROM public.contratos WHERE aluno_id IN (SELECT id FROM alunos_cpf) AND catalogo_id IN (SELECT id FROM itens)
    ) INTO v_usado;
    IF v_usado THEN
      RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Este CPF já contratou o Plano Semestral (inclusive cancelado) e não pode recontratar.');
    END IF;
  END IF;
  RETURN jsonb_build_object('elegivel', true, 'agregadora', v_agr, 'motivo', null);
END $$;

CREATE OR REPLACE FUNCTION public.fn_semestral_itens_elegiveis(p_aluno uuid, p_hoje date DEFAULT NULL)
RETURNS SETOF public.planos_catalogo LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.planos_catalogo c
  WHERE c.agregadora_requerida IS NOT NULL AND COALESCE(c.ativo, false)
    AND (public.fn_semestral_elegivel(p_aluno, c.codigo, p_hoje) ->> 'elegivel')::boolean
  ORDER BY c.valor;
$$;

CREATE OR REPLACE FUNCTION public.fn_semestral_trava_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod text; r jsonb;
BEGIN
  IF NEW.catalogo_id IS NULL OR current_setting('fortem.semestral_renovacao', true) = 'on' THEN RETURN NEW; END IF;
  SELECT codigo INTO v_cod FROM public.planos_catalogo WHERE id = NEW.catalogo_id AND agregadora_requerida IS NOT NULL;
  IF v_cod IS NULL THEN RETURN NEW; END IF;
  -- vendas é gravada primeiro na venda; em planos a checagem de CPF já foi feita.
  r := public.fn_semestral_elegivel(NEW.aluno_id, v_cod, NULL, TG_TABLE_NAME = 'planos');
  IF NOT (r->>'elegivel')::boolean THEN
    RAISE EXCEPTION 'Plano Semestral não permitido: %', r->>'motivo';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_semestral_trava_venda BEFORE INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.fn_semestral_trava_venda();
CREATE TRIGGER trg_semestral_trava_plano BEFORE INSERT ON public.planos FOR EACH ROW EXECUTE FUNCTION public.fn_semestral_trava_venda();

CREATE POLICY catalogo_planos_oculta_agregadora ON public.planos_catalogo AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (agregadora_requerida IS NULL);

REVOKE ALL ON FUNCTION public.fn_semestral_elegivel(uuid, text, date, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_semestral_itens_elegiveis(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_semestral_trava_venda() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_elegivel(uuid, text, date, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_semestral_itens_elegiveis(uuid, date) TO authenticated, service_role;