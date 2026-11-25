CREATE OR REPLACE FUNCTION public.fn_promo10_ofertas(p_aluno_id uuid, p_hoje date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_desc_ex_aluno numeric(10,2) := public.fn_promo10_desconto_ex_aluno();
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
  v_ref_start numeric(10,2);
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

      FOR v_item IN
        SELECT codigo, nome, nome_exibicao, valor, periodo_meses, frequencia
          FROM public.planos_catalogo
         WHERE agregadora_requerida = v_agr
           AND familia = 'semestral_2027'
           AND COALESCE(ativo, false)
         ORDER BY
           CASE frequencia::text WHEN '2x' THEN 1 WHEN '3x' THEN 2 ELSE 3 END,
           valor ASC
      LOOP
        v_eleg := public.fn_semestral_elegivel(p_aluno_id, v_item.codigo, v_hoje, false);
        IF COALESCE((v_eleg->>'elegivel')::boolean, false) THEN
          v_ref_start := NULL;
          SELECT valor INTO v_ref_start
            FROM public.planos_catalogo
           WHERE codigo = 'start_2027_' || v_item.frequencia::text || '_mensal'
           LIMIT 1;

          v_principal := v_principal || jsonb_build_array(
            jsonb_build_object(
              'tipo', 'semestral_agregadora',
              'codigo', v_item.codigo,
              'nome', COALESCE(v_item.nome_exibicao, v_item.nome),
              'agregadora', v_agr,
              'frequencia', v_item.frequencia::text,
              'valor_mensal', v_item.valor,
              'valor_promocional', round(v_item.valor * 6, 2),
              'valor_referencia_mes', v_ref_start,
              'valor_sem_desconto', CASE WHEN v_ref_start IS NOT NULL THEN round(v_ref_start * 6, 2) ELSE NULL END,
              'economia_mes', CASE WHEN v_ref_start IS NOT NULL THEN round(v_ref_start - v_item.valor, 2) ELSE NULL END,
              'economia_6_meses', CASE WHEN v_ref_start IS NOT NULL THEN round((v_ref_start - v_item.valor) * 6, 2) ELSE NULL END
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
          v_promo := round(v_item.valor - v_desc_ex_aluno, 2);
        ELSE
          v_sem_desc := round((v_item.valor + v_item.taxa_recorrencia) * 12, 2);
          v_promo := round(v_sem_desc - v_desc_ex_aluno, 2);
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
            'economia', v_desc_ex_aluno
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
$function$;