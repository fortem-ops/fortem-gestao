CREATE SEQUENCE IF NOT EXISTS public.promo10_interesses_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.promo10_interesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  segmento text NOT NULL,
  oferta text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_promocional numeric(10,2) NOT NULL,
  valor_sem_desconto numeric(10,2),
  codigo_pedido text NOT NULL UNIQUE DEFAULT ('P10-' || lpad(nextval('public.promo10_interesses_seq')::text, 4, '0')),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'contatado', 'fechado', 'desistiu')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  atualizado_em timestamptz
);

CREATE INDEX idx_promo10_interesses_aluno_id ON public.promo10_interesses(aluno_id);
CREATE INDEX idx_promo10_interesses_status ON public.promo10_interesses(status);

GRANT ALL ON public.promo10_interesses TO service_role;
GRANT SELECT, UPDATE ON public.promo10_interesses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.promo10_interesses_seq TO service_role;

ALTER TABLE public.promo10_interesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo10_interesses_admin_select"
  ON public.promo10_interesses
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "promo10_interesses_admin_update"
  ON public.promo10_interesses
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.trg_promo10_interesses_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.aluno_id IS DISTINCT FROM OLD.aluno_id
       OR NEW.segmento IS DISTINCT FROM OLD.segmento
       OR NEW.oferta IS DISTINCT FROM OLD.oferta
       OR NEW.detalhes IS DISTINCT FROM OLD.detalhes
       OR NEW.valor_promocional IS DISTINCT FROM OLD.valor_promocional
       OR NEW.valor_sem_desconto IS DISTINCT FROM OLD.valor_sem_desconto
       OR NEW.codigo_pedido IS DISTINCT FROM OLD.codigo_pedido
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Somente status e observacao podem ser alterados pela equipe.';
    END IF;
    NEW.atualizado_por := auth.uid();
    NEW.atualizado_em := now();
  ELSE
    NEW.atualizado_em := COALESCE(NEW.atualizado_em, now());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_promo10_interesses_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER promo10_interesses_before_update
  BEFORE UPDATE ON public.promo10_interesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_promo10_interesses_update();

CREATE OR REPLACE FUNCTION public.fn_promo10_ciclo(
  p_data_inicio date,
  p_data_fim date,
  p_hoje date,
  p_degraus integer,
  p_valor_mes numeric
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_efetivo date;
  v_k integer := 0;
  v_ciclo_ini date;
  v_ciclo_fim date;
  v_dias_ciclo integer := 0;
  v_dias_rest integer := 0;
  v_proporcional numeric(10,2) := 0;
  v_ciclos_completos integer := 0;
  v_valor_completos numeric(10,2) := 0;
  v_ultimo_proporcional numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_hoje IS NULL
     OR p_degraus IS NULL OR p_degraus <= 0
     OR p_valor_mes IS NULL OR p_valor_mes <= 0
     OR p_hoje >= p_data_fim THEN
    RETURN jsonb_build_object(
      'proporcional', 0,
      'ciclos_completos', 0,
      'valor_completos', 0,
      'ultimo_proporcional', 0,
      'total', 0,
      'dias_restantes_ciclo_atual', 0,
      'dias_ciclo_atual', 0
    );
  END IF;

  v_efetivo := GREATEST(p_hoje, p_data_inicio);

  -- Avanca ate o ciclo que contem v_efetivo
  v_k := 0;
  LOOP
    v_ciclo_ini := (p_data_inicio + make_interval(months => v_k))::date;
    v_ciclo_fim := (p_data_inicio + make_interval(months => v_k + 1))::date;
    EXIT WHEN v_efetivo < v_ciclo_fim;
    v_k := v_k + 1;
  END LOOP;

  -- Caso 1: o plano termina dentro do ciclo atual
  IF p_data_fim <= v_ciclo_fim THEN
    v_dias_ciclo := v_ciclo_fim - v_ciclo_ini;
    v_dias_rest := p_data_fim - v_efetivo;
    v_proporcional := round((p_valor_mes * p_degraus * v_dias_rest)::numeric / v_dias_ciclo, 2);
    v_total := v_proporcional;
    RETURN jsonb_build_object(
      'proporcional', v_proporcional,
      'ciclos_completos', 0,
      'valor_completos', 0,
      'ultimo_proporcional', 0,
      'total', v_total,
      'dias_restantes_ciclo_atual', v_dias_rest,
      'dias_ciclo_atual', v_dias_ciclo
    );
  END IF;

  -- Caso 2: ciclo atual tem parte proporcional (se v_efetivo > v_ciclo_ini)
  IF v_efetivo > v_ciclo_ini THEN
    v_dias_ciclo := v_ciclo_fim - v_ciclo_ini;
    v_dias_rest := v_ciclo_fim - v_efetivo;
    v_proporcional := round((p_valor_mes * p_degraus * v_dias_rest)::numeric / v_dias_ciclo, 2);
    v_k := v_k + 1;
  END IF;

  -- Conta ciclos completos inteiros que cabem ate p_data_fim
  LOOP
    v_ciclo_ini := (p_data_inicio + make_interval(months => v_k))::date;
    v_ciclo_fim := (p_data_inicio + make_interval(months => v_k + 1))::date;
    EXIT WHEN v_ciclo_fim > p_data_fim;
    v_ciclos_completos := v_ciclos_completos + 1;
    v_k := v_k + 1;
  END LOOP;

  -- Ultimo pedaco proporcional se p_data_fim cair no meio de um ciclo
  IF v_ciclo_ini < p_data_fim THEN
    v_ultimo_proporcional := round(
      (p_valor_mes * p_degraus * (p_data_fim - v_ciclo_ini))::numeric / (v_ciclo_fim - v_ciclo_ini),
      2
    );
  END IF;

  v_valor_completos := round((p_valor_mes * p_degraus * v_ciclos_completos)::numeric, 2);
  v_total := round(v_proporcional + v_valor_completos + v_ultimo_proporcional, 2);

  RETURN jsonb_build_object(
    'proporcional', v_proporcional,
    'ciclos_completos', v_ciclos_completos,
    'valor_completos', v_valor_completos,
    'ultimo_proporcional', v_ultimo_proporcional,
    'total', v_total,
    'dias_restantes_ciclo_atual', v_dias_rest,
    'dias_ciclo_atual', v_dias_ciclo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_promo10_ciclo(date, date, date, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_ciclo(date, date, date, integer, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_promo10_ofertas(
  p_aluno_id uuid,
  p_hoje date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_aluno record;
  v_plano public.planos;
  v_cat public.planos_catalogo;
  v_segmento text := 'sem_oferta';
  v_principal jsonb := '[]'::jsonb;
  v_corrida jsonb := null;
  v_freq_atual integer;
  v_nivel_atual integer;
  v_target integer;
  v_degraus integer;
  v_freq_label text;
  v_calc_promo jsonb;
  v_calc_cheio jsonb;
  v_agr text;
  v_eleg jsonb;
  v_ref_start3x numeric(10,2);
  v_item record;
  v_tem_historico boolean;
  v_tem_corrida boolean;
  v_corrida_nome text;
  v_corrida_valor numeric(10,2);
  v_sem_desc numeric(10,2);
  v_promo numeric(10,2);
BEGIN
  IF v_hoje > DATE '2026-12-31' THEN
    RETURN jsonb_build_object(
      'encerrada', true,
      'segmento', null,
      'principal', '[]'::jsonb,
      'corrida', null
    );
  END IF;

  SELECT id, COALESCE(is_equipe, false) AS is_equipe
    INTO v_aluno
    FROM public.alunos
   WHERE id = p_aluno_id;

  IF NOT FOUND OR v_aluno.is_equipe THEN
    RETURN jsonb_build_object(
      'encerrada', false,
      'segmento', CASE WHEN FOUND AND v_aluno.is_equipe THEN 'equipe' ELSE 'sem_oferta' END,
      'principal', '[]'::jsonb,
      'corrida', null
    );
  END IF;

  v_plano := public.fn_plano_principal_ativo(p_aluno_id);

  IF v_plano.id IS NOT NULL THEN
    IF v_plano.catalogo_id IS NOT NULL THEN
      SELECT * INTO v_cat FROM public.planos_catalogo WHERE id = v_plano.catalogo_id;
    END IF;

    -- 1. Upgrade: Start+ (antigo), Power (antigo/2027), Pro (antigo/2027) com data_fim futura
    IF (
         (v_plano.catalogo_id IS NOT NULL AND v_cat.familia IN ('power_2027', 'pro_2027'))
         OR (v_plano.catalogo_id IS NULL AND v_plano.tipo IN ('Start+', 'Power', 'Pro'))
       )
       AND v_plano.data_fim IS NOT NULL
       AND v_plano.data_fim > v_hoje THEN

      v_segmento := 'upgrade';

      IF v_plano.catalogo_id IS NOT NULL THEN
        v_nivel_atual := CASE v_cat.frequencia::text
          WHEN '1x' THEN 1
          WHEN '2x' THEN 2
          WHEN '3x' THEN 3
          WHEN 'livre' THEN 4
          ELSE NULL
        END;
      ELSE
        SELECT c.frequencia_semanal
          INTO v_freq_atual
          FROM public.contratos c
         WHERE c.plano_id = v_plano.id
           AND c.status = 'ativo'
         ORDER BY c.created_at DESC
         LIMIT 1;

        v_nivel_atual := CASE v_freq_atual
          WHEN 1 THEN 1
          WHEN 2 THEN 2
          WHEN 3 THEN 3
          WHEN 5 THEN 4
          ELSE NULL
        END;
      END IF;

      IF v_nivel_atual IS NOT NULL AND v_nivel_atual < 4 THEN
        FOR v_target IN (v_nivel_atual + 1)..4 LOOP
          v_degraus := v_target - v_nivel_atual;
          v_freq_label := CASE v_target
            WHEN 2 THEN '2x'
            WHEN 3 THEN '3x'
            WHEN 4 THEN 'livre'
          END;
          v_calc_promo := public.fn_promo10_ciclo(v_plano.data_inicio, v_plano.data_fim, v_hoje, v_degraus, 80.00);
          v_calc_cheio := public.fn_promo10_ciclo(v_plano.data_inicio, v_plano.data_fim, v_hoje, v_degraus, 100.00);

          v_principal := v_principal || jsonb_build_array(
            jsonb_build_object(
              'tipo', 'upgrade',
              'plano_atual', v_plano.tipo,
              'frequencia_atual', CASE v_nivel_atual WHEN 1 THEN '1x' WHEN 2 THEN '2x' WHEN 3 THEN '3x' END,
              'frequencia_destino', v_freq_label,
              'degraus', v_degraus,
              'data_inicio_ciclo', v_plano.data_inicio,
              'data_fim_plano', v_plano.data_fim,
              'valor_promocional', (v_calc_promo->>'total')::numeric,
              'valor_sem_desconto', (v_calc_cheio->>'total')::numeric,
              'economia', round((v_calc_cheio->>'total')::numeric - (v_calc_promo->>'total')::numeric, 2),
              'calculo_promocional', v_calc_promo,
              'calculo_sem_desconto', v_calc_cheio
            )
          );
        END LOOP;
      END IF;

    -- 2. Agregadoras (Wellhub / TotalPass)
    ELSIF v_plano.tipo IN ('Gympass/Wellhub', 'Total Pass') THEN
      v_agr := CASE WHEN v_plano.tipo = 'Gympass/Wellhub' THEN 'wellhub' ELSE 'totalpass' END;
      v_segmento := v_agr;

      SELECT valor INTO v_ref_start3x
        FROM public.planos_catalogo
       WHERE codigo = 'start_2027_3x_mensal'
       LIMIT 1;

      FOR v_item IN
        SELECT codigo, nome, nome_exibicao, valor, periodo_meses, frequencia
          FROM public.planos_catalogo
         WHERE agregadora_requerida = v_agr
           AND familia = 'semestral_2027'
         ORDER BY valor ASC
      LOOP
        v_eleg := public.fn_semestral_elegivel(p_aluno_id, v_item.codigo, v_hoje, false);
        IF COALESCE((v_eleg->>'elegivel')::boolean, false) THEN
          v_principal := v_principal || jsonb_build_array(
            jsonb_build_object(
              'tipo', 'semestral_agregadora',
              'codigo', v_item.codigo,
              'nome', COALESCE(v_item.nome_exibicao, v_item.nome),
              'agregadora', v_agr,
              'frequencia', v_item.frequencia::text,
              'valor_mensal', v_item.valor,
              'valor_promocional', round(v_item.valor * 6, 2),
              'valor_referencia_mes', v_ref_start3x,
              'valor_sem_desconto', CASE WHEN v_ref_start3x IS NOT NULL THEN round(v_ref_start3x * 6, 2) ELSE NULL END,
              'economia_mes', CASE WHEN v_ref_start3x IS NOT NULL THEN round(v_ref_start3x - v_item.valor, 2) ELSE NULL END,
              'economia_6_meses', CASE WHEN v_ref_start3x IS NOT NULL THEN round((v_ref_start3x - v_item.valor) * 6, 2) ELSE NULL END
            )
          );
        END IF;
      END LOOP;

    ELSIF v_plano.tipo ILIKE 'Corrida%' THEN
      v_segmento := 'so_corrida';
    ELSE
      v_segmento := 'sem_oferta';
    END IF;

  ELSE
    -- 3. Sem plano ativo: ex-aluno (tem historico em planos, inclusive agregadora)
    SELECT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = p_aluno_id)
      INTO v_tem_historico;

    IF v_tem_historico THEN
      v_segmento := 'ex_aluno';

      FOR v_item IN
        SELECT codigo, nome, nome_exibicao, familia, frequencia, modalidade_cobranca, valor, COALESCE(taxa_recorrencia, 0) AS taxa_recorrencia
          FROM public.planos_catalogo
         WHERE familia IN ('power_2027', 'pro_2027')
           AND modalidade_cobranca IN ('anual', 'recorrencia_mensal')
         ORDER BY
           CASE familia WHEN 'power_2027' THEN 1 ELSE 2 END,
           CASE frequencia::text WHEN '1x' THEN 1 WHEN '2x' THEN 2 WHEN '3x' THEN 3 WHEN 'livre' THEN 4 ELSE 5 END,
           CASE modalidade_cobranca WHEN 'anual' THEN 1 ELSE 2 END
      LOOP
        IF v_item.modalidade_cobranca = 'anual' THEN
          v_sem_desc := round(v_item.valor, 2);
          v_promo := round(v_item.valor - 400.00, 2);
        ELSE
          v_sem_desc := round((v_item.valor + v_item.taxa_recorrencia) * 12, 2);
          v_promo := round(v_sem_desc - 400.00, 2);
        END IF;

        v_principal := v_principal || jsonb_build_array(
          jsonb_build_object(
            'tipo', 'ex_aluno',
            'codigo', v_item.codigo,
            'nome', COALESCE(v_item.nome_exibicao, v_item.nome),
            'familia', v_item.familia,
            'frequencia', v_item.frequencia::text,
            'modalidade_cobranca', v_item.modalidade_cobranca,
            'valor_sem_desconto', v_sem_desc,
            'valor_promocional', v_promo,
            'parcela_12x', round(v_promo / 12.0, 2),
            'economia', 400.00
          )
        );
      END LOOP;
    END IF;
  END IF;

  -- 4. Corrida 6+1 meses (soma para qualquer aluno sem Corrida ativa)
  v_tem_corrida := public.fn_tem_plano_corrida(p_aluno_id, v_hoje);
  IF NOT v_tem_corrida THEN
    IF v_plano.id IS NOT NULL THEN
      IF v_plano.catalogo_id IS NOT NULL THEN
        v_corrida_nome := CASE v_cat.familia
          WHEN 'pro_2027' THEN 'Corrida - Pro'
          WHEN 'power_2027' THEN 'Corrida - Power'
          WHEN 'start_2027' THEN 'Corrida - Start'
          ELSE 'Corrida - Sem Plano'
        END;
      ELSE
        v_corrida_nome := CASE
          WHEN v_plano.tipo IN ('Pro', 'VIP') THEN 'Corrida - Pro'
          WHEN v_plano.tipo = 'Power' THEN 'Corrida - Power'
          WHEN v_plano.tipo = 'Start+' THEN 'Corrida - Start+'
          WHEN v_plano.tipo = 'Start' THEN 'Corrida - Start'
          ELSE 'Corrida - Sem Plano'
        END;
      END IF;
    ELSE
      v_corrida_nome := 'Corrida - Sem Plano';
    END IF;

    SELECT valor
      INTO v_corrida_valor
      FROM public.planos_catalogo
     WHERE nome = v_corrida_nome
       AND periodo_meses = 6
     LIMIT 1;

    IF v_corrida_valor IS NOT NULL THEN
      v_corrida := jsonb_build_object(
        'tipo', 'corrida_6_mais_1',
        'nome_catalogo', v_corrida_nome,
        'meses_pagos', 6,
        'meses_total', 7,
        'valor_promocional', round(v_corrida_valor, 2),
        'valor_equivalente_mes', round(v_corrida_valor / 7.0, 2),
        'valor_sem_desconto', round(v_corrida_valor * 7.0 / 6.0, 2),
        'economia', round(v_corrida_valor / 6.0, 2)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'encerrada', false,
    'segmento', v_segmento,
    'principal', v_principal,
    'corrida', v_corrida
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_promo10_ofertas(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_ofertas(uuid, date) TO service_role;