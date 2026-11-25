CREATE OR REPLACE FUNCTION public.fn_venda_2027_criar_retroativa(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_motivo text := NULLIF(trim(COALESCE(p->>'motivo', '')), '');
  v_override_raw text := NULLIF(trim(COALESCE(p->>'valor_plano_override', '')), '');
  v_override_c bigint;
  v_desc_c bigint := round(COALESCE((p->>'desconto')::numeric, 0) * 100);
  v_data_venda date := NULLIF(trim(COALESCE(p->>'data_venda', '')), '')::date;
  v_ja_pago boolean := COALESCE((p->>'ja_pago')::boolean, false);
  v_forma_rec text := NULLIF(trim(COALESCE(p->>'forma_recebimento', '')), '');
  v_bandeira text := NULLIF(trim(COALESCE(p->>'bandeira', '')), '');
  v_parc_cartao smallint := NULLIF(trim(COALESCE(p->>'parcelas_cartao', '')), '')::smallint;
  v_data_pagamento date := NULLIF(trim(COALESCE(p->>'data_pagamento', '')), '')::date;
  v_gateway text;
  v_venda_forma text;
  r jsonb;
  c record;
  v_venda uuid;
  v_contrato uuid;
  v_ehstart boolean;
  v_ehmensal boolean;
  v_ciclo boolean;
  v_cat_c bigint;
  v_plano_c bigint;
  v_serv_c bigint;
  v_n int;
  v_diff_c bigint;
  v_base bigint;
  v_pbase bigint;
  v_valor_catalogo numeric;
  v_valor_cobrado numeric;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar venda retroativa ou com valor ajustado';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da venda retroativa ou do ajuste de valor';
  END IF;

  IF v_override_raw IS NOT NULL THEN
    v_override_c := round(v_override_raw::numeric * 100);
    IF v_override_c <= 0 THEN
      RAISE EXCEPTION 'Valor cobrado inválido';
    END IF;
    IF v_desc_c > 0 THEN
      RAISE EXCEPTION 'Não é possível combinar valor cobrado manual com desconto';
    END IF;
  END IF;

  IF v_ja_pago THEN
    IF v_forma_rec IS NULL OR v_forma_rec NOT IN ('dinheiro', 'pix', 'maquina_debito', 'maquina_credito', 'boleto') THEN
      RAISE EXCEPTION 'Forma de recebimento inválida para venda já paga';
    END IF;
    IF v_forma_rec IN ('maquina_debito', 'maquina_credito') AND v_bandeira IS NULL THEN
      RAISE EXCEPTION 'Selecione a bandeira do cartão';
    END IF;
    IF v_forma_rec = 'maquina_credito' THEN
      v_parc_cartao := COALESCE(v_parc_cartao, 1);
      IF v_parc_cartao < 1 OR v_parc_cartao > 12 THEN
        RAISE EXCEPTION 'Informe um número de parcelas entre 1 e 12';
      END IF;
    ELSE
      v_parc_cartao := NULL;
    END IF;
    IF v_forma_rec NOT IN ('maquina_debito', 'maquina_credito') THEN
      v_bandeira := NULL;
    END IF;
    v_data_pagamento := COALESCE(v_data_pagamento, v_data_venda, NULLIF(trim(COALESCE(p->>'data_inicio', '')), '')::date, CURRENT_DATE);
    v_gateway := CASE v_forma_rec
      WHEN 'dinheiro' THEN 'dinheiro'
      WHEN 'pix' THEN 'inter_pix'
      WHEN 'maquina_debito' THEN 'maquina'
      WHEN 'maquina_credito' THEN 'maquina'
      WHEN 'boleto' THEN 'boleto'
    END;
    v_venda_forma := CASE v_forma_rec
      WHEN 'dinheiro' THEN 'dinheiro'
      WHEN 'pix' THEN 'pix'
      WHEN 'maquina_debito' THEN 'cartao_debito'
      WHEN 'maquina_credito' THEN 'cartao_credito'
      WHEN 'boleto' THEN 'boleto'
    END;
  END IF;

  r := public.fn_venda_2027_criar(p);
  IF COALESCE((r->>'repetida')::boolean, false) THEN
    RETURN r;
  END IF;

  v_venda := (r->>'venda_id')::uuid;
  v_contrato := (r->>'contrato_id')::uuid;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid;
  v_ehstart := c.familia = 'start_2027';
  v_ehmensal := c.modalidade_cobranca = 'recorrencia_mensal';
  v_ciclo := v_ehstart OR (c.familia = 'consultoria_2027' AND v_ehmensal);
  v_valor_catalogo := c.valor;

  IF v_override_c IS NOT NULL THEN
    IF v_ehmensal THEN
      v_cat_c := round((c.valor + CASE WHEN v_ciclo THEN 0 ELSE COALESCE(c.taxa_recorrencia, 0) END) * 100);
      IF v_override_c < v_cat_c THEN
        RAISE EXCEPTION 'Valor cobrado não pode ser menor que o catálogo (use desconto)';
      END IF;
      v_diff_c := v_override_c - v_cat_c;
      v_valor_catalogo := v_cat_c / 100.0;
      v_valor_cobrado := v_override_c / 100.0;

      IF v_diff_c > 0 THEN
        UPDATE public.cobrancas
        SET valor = v_override_c / 100.0,
            composicao = jsonb_set(COALESCE(composicao, '{}'::jsonb), '{plano}', to_jsonb(v_override_c / 100.0))
        WHERE contrato_id = v_contrato AND numero_ciclo = 1;

        UPDATE public.vendas
        SET valor = valor + v_diff_c / 100.0,
            valor_final = valor_final + v_diff_c / 100.0
        WHERE id = v_venda;

        UPDATE public.contratos
        SET valor_base = valor_base + v_diff_c / 100.0,
            valor_cobrado = valor_cobrado + v_diff_c / 100.0
        WHERE id = v_contrato;
      END IF;
    ELSE
      SELECT round(valor_base * 100), round(valor_cobrado * 100) - round(valor_base * 100), parcelas
        INTO v_plano_c, v_serv_c, v_n
      FROM public.contratos
      WHERE id = v_contrato;

      IF v_override_c < v_plano_c THEN
        RAISE EXCEPTION 'Valor cobrado não pode ser menor que o catálogo (use desconto)';
      END IF;
      v_valor_catalogo := v_plano_c / 100.0;
      v_valor_cobrado := v_override_c / 100.0;

      IF v_override_c > v_plano_c THEN
        v_base := (v_override_c + v_serv_c) / v_n;
        v_pbase := v_override_c / v_n;

        UPDATE public.cobrancas cb2
        SET valor = x.parcela_total / 100.0,
            composicao = jsonb_set(
              jsonb_set(COALESCE(cb2.composicao, '{}'::jsonb), '{plano}', to_jsonb(x.parcela_plano / 100.0)),
              '{servicos}', to_jsonb((x.parcela_total - x.parcela_plano) / 100.0)
            )
        FROM (
          SELECT c2.id,
                 CASE WHEN c2.numero_ciclo = v_n THEN (v_override_c + v_serv_c) - v_base * (v_n - 1) ELSE v_base END AS parcela_total,
                 CASE WHEN c2.numero_ciclo = v_n THEN v_override_c - v_pbase * (v_n - 1) ELSE v_pbase END AS parcela_plano
          FROM public.cobrancas c2
          WHERE c2.contrato_id = v_contrato AND c2.numero_ciclo BETWEEN 1 AND v_n
        ) x
        WHERE cb2.id = x.id;

        UPDATE public.vendas
        SET valor = (v_override_c + v_serv_c) / 100.0,
            valor_final = (v_override_c + v_serv_c) / 100.0
        WHERE id = v_venda;

        UPDATE public.contratos
        SET valor_base = v_override_c / 100.0,
            valor_cobrado = (v_override_c + v_serv_c) / 100.0
        WHERE id = v_contrato;
      END IF;
    END IF;
  END IF;

  IF v_data_venda IS NOT NULL THEN
    UPDATE public.vendas
    SET data_venda = v_data_venda
    WHERE id = v_venda;
  END IF;

  IF v_ja_pago THEN
    UPDATE public.cobrancas
    SET status = 'pago',
        data_pagamento = v_data_pagamento,
        forma_pagamento = v_forma_rec,
        gateway = v_gateway,
        bandeira = v_bandeira,
        parcelas_cartao = v_parc_cartao,
        meio_registro = 'manual_admin'
    WHERE contrato_id = v_contrato
      AND (NOT v_ehmensal OR numero_ciclo = 1);

    UPDATE public.vendas
    SET status_pagamento = 'pago',
        forma_pagamento = v_venda_forma
    WHERE id = v_venda;
  END IF;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES (
    'vendas',
    v_venda,
    'venda_retroativa',
    v_uid,
    jsonb_build_object('valor_catalogo', v_valor_catalogo),
    jsonb_build_object(
      'motivo', v_motivo,
      'valor_cobrado', COALESCE(v_valor_cobrado, v_valor_catalogo),
      'data_venda', v_data_venda,
      'ja_pago', v_ja_pago,
      'forma_recebimento', v_forma_rec,
      'bandeira', v_bandeira,
      'parcelas_cartao', v_parc_cartao,
      'data_pagamento', v_data_pagamento
    )
  );

  RETURN r || jsonb_build_object(
    'retroativa', true,
    'ja_pago', v_ja_pago,
    'valor_plano_override', CASE WHEN v_override_c IS NOT NULL THEN v_override_c / 100.0 ELSE NULL END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_venda_2027_criar_retroativa(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_2027_criar_retroativa(jsonb) TO authenticated, service_role;
