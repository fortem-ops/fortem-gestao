CREATE TABLE public.recovery_mensal_ciclos (
  aluno_id uuid NOT NULL,
  competencia date NOT NULL,
  validade date NOT NULL,
  plano_id uuid NOT NULL,
  credito_id uuid,
  quantidade int NOT NULL,
  carga_inicial boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aluno_id, competencia)
);
GRANT SELECT ON public.recovery_mensal_ciclos TO authenticated;
GRANT ALL ON public.recovery_mensal_ciclos TO service_role;
ALTER TABLE public.recovery_mensal_ciclos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le ciclos recovery" ON public.recovery_mensal_ciclos FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()) OR aluno_id = public.aluno_user_id(auth.uid()));

-- Tipos de plano com direito a 4 sessões de Recovery por ciclo (fora do Pro 2027).
CREATE OR REPLACE FUNCTION public.fn_recovery_mensal_tipo_elegivel(p_tipo text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_tipo IN ('Pro','Corrida - Start','Corrida - Start+','Corrida - Power','Corrida - Pro',
                    'Corrida - Prospect','Corrida - Sem Plano')
      OR p_tipo ILIKE 'VIP%'
$$;

CREATE OR REPLACE FUNCTION public.fn_recovery_mensal(p_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date), p_carga_inicial boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tol int; r record; v_i int; v_comp date; v_valid date; v_qtd int; v_cred uuid;
  v_forma text; v_contrato uuid; cb record;
  n_lib int := 0; n_bloq int := 0; n_desat int := 0;
BEGIN
  SELECT NULLIF(sc.valor #>> '{}', '')::int INTO v_tol FROM public.sistema_config sc WHERE sc.chave = 'creditos_2027_tolerancia_dias';
  v_tol := COALESCE(v_tol, 3);

  FOR r IN
    SELECT DISTINCT ON (p.aluno_id) p.aluno_id, p.id AS plano_id, p.data_inicio
    FROM public.planos p
    LEFT JOIN public.planos_catalogo c ON c.id = p.catalogo_id
    JOIN public.alunos a ON a.id = p.aluno_id AND COALESCE(a.is_equipe, false) = false
    WHERE p.ativo AND p.data_inicio <= p_data AND (p.data_fim IS NULL OR p.data_fim >= p_data)
      AND public.fn_recovery_mensal_tipo_elegivel(p.tipo)
      AND COALESCE(c.familia, '') <> 'pro_2027'
      AND NOT EXISTS (SELECT 1 FROM public.planos p2 JOIN public.planos_catalogo c2 ON c2.id = p2.catalogo_id
                      WHERE p2.aluno_id = p.aluno_id AND p2.ativo AND c2.familia = 'pro_2027')
    ORDER BY p.aluno_id, p.data_inicio, p.created_at
  LOOP
    v_i := (extract(year FROM age(p_data, r.data_inicio)) * 12 + extract(month FROM age(p_data, r.data_inicio)))::int;
    v_comp := (r.data_inicio + make_interval(months => v_i))::date;
    v_valid := (r.data_inicio + make_interval(months => v_i + 1) - interval '1 day')::date;

    IF EXISTS (SELECT 1 FROM public.recovery_mensal_ciclos WHERE aluno_id = r.aluno_id AND competencia = v_comp) THEN
      CONTINUE;
    END IF;

    -- pendência vencida além da tolerância bloqueia a liberação
    IF EXISTS (SELECT 1 FROM public.cobrancas x WHERE x.aluno_id = r.aluno_id AND x.status IN ('pendente','atrasado')
               AND x.data_vencimento + v_tol < p_data) THEN
      n_bloq := n_bloq + 1; CONTINUE;
    END IF;

    -- cartão recorrente: a mensalidade do ciclo precisa estar paga (ou dentro da tolerância)
    SELECT k.id, k.forma_pagamento INTO v_contrato, v_forma FROM public.contratos k
      WHERE k.plano_id = r.plano_id AND k.status = 'ativo' ORDER BY k.created_at DESC LIMIT 1;
    IF v_forma = 'cartao_recorrencia' THEN
      cb := NULL;
      SELECT x.status, x.data_vencimento INTO cb FROM public.cobrancas x
       WHERE x.contrato_id = v_contrato AND x.data_vencimento BETWEEN v_comp - 15 AND v_valid
       ORDER BY abs(x.data_vencimento - v_comp) LIMIT 1;
      IF cb.status IS NULL OR NOT (cb.status = 'pago' OR p_data <= cb.data_vencimento + v_tol) THEN
        n_bloq := n_bloq + 1; CONTINUE;
      END IF;
    END IF;

    v_qtd := 4;
    IF p_carga_inicial THEN
      v_qtd := GREATEST(4 - (SELECT count(*) FROM public.agenda_servicos s
                 WHERE s.aluno_id = r.aluno_id AND s.atividade = 'Recovery (Bota de Compressão)'
                   AND s.data_especifica BETWEEN v_comp AND v_valid)::int, 0);
    END IF;

    -- sem acúmulo: saldo mensal anterior deixa de valer
    WITH d AS (
      UPDATE public.creditos_aluno ca SET ativo = false, updated_at = now()
      FROM public.recovery_mensal_ciclos rc
      WHERE rc.aluno_id = r.aluno_id AND rc.competencia < v_comp AND rc.credito_id = ca.id AND ca.ativo
      RETURNING ca.id)
    SELECT n_desat + count(*) INTO n_desat FROM d;

    v_cred := NULL;
    IF v_qtd > 0 THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
        data_validade, competencia, reposicao_pct)
      VALUES (r.aluno_id, 'plano', r.plano_id, 'Recovery (Bota de Compressão)', v_qtd, false, v_valid, v_comp, 0)
      ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
      IF v_cred IS NULL THEN CONTINUE; END IF;
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
      VALUES (v_cred, 'compra', v_qtd, 'Recovery mensal (Pro/Corrida) ciclo ' || to_char(v_comp, 'DD/MM/YYYY')
        || CASE WHEN p_carga_inicial THEN ' — liberação inicial' ELSE '' END);
    END IF;
    INSERT INTO public.recovery_mensal_ciclos (aluno_id, competencia, validade, plano_id, credito_id, quantidade, carga_inicial)
    VALUES (r.aluno_id, v_comp, v_valid, r.plano_id, v_cred, v_qtd, p_carga_inicial);
    n_lib := n_lib + 1;
  END LOOP;

  RETURN jsonb_build_object('data', p_data, 'liberados', n_lib, 'bloqueados_pagamento', n_bloq, 'saldos_anteriores_desativados', n_desat);
END $$;
REVOKE ALL ON FUNCTION public.fn_recovery_mensal(date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recovery_mensal(date, boolean) TO service_role;

-- Leitura do portal: saldo do ciclo mensal do próprio aluno.
CREATE OR REPLACE FUNCTION public.fn_recovery_mensal_meu()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aluno uuid; rc record; v_saldo int;
BEGIN
  v_aluno := public.aluno_user_id(auth.uid());
  IF v_aluno IS NULL THEN RETURN jsonb_build_object('ativo', false); END IF;
  SELECT * INTO rc FROM public.recovery_mensal_ciclos
   WHERE aluno_id = v_aluno AND competencia <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
     AND validade >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
   ORDER BY competencia DESC LIMIT 1;
  IF rc IS NULL THEN RETURN jsonb_build_object('ativo', false); END IF;
  SELECT GREATEST(quantidade_inicial - quantidade_usada, 0) INTO v_saldo FROM public.creditos_aluno WHERE id = rc.credito_id AND ativo;
  RETURN jsonb_build_object('ativo', true, 'total', 4, 'saldo', COALESCE(v_saldo, 0), 'renova_em', rc.validade + 1);
END $$;
REVOKE ALL ON FUNCTION public.fn_recovery_mensal_meu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_recovery_mensal_meu() TO authenticated;

SELECT cron.schedule('recovery-mensal-diario', '15 7 * * *', $$SELECT public.fn_recovery_mensal();$$);