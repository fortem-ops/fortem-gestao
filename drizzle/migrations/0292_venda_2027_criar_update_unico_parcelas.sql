CREATE OR REPLACE FUNCTION public.fn_venda_2027_criar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_teste boolean;
  v_desc_c bigint := round(COALESCE((p->>'desconto')::numeric, 0) * 100);
  v_rec boolean := COALESCE((p->>'desconto_recorrente')::boolean, false);
  r jsonb; c record; v_venda uuid; v_plano uuid; v_contrato uuid;
  v_ehstart boolean; v_ehmensal boolean; v_ciclo boolean; v_plano_c bigint; v_novo_c bigint; v_serv_c bigint; v_n int;
  v_base bigint; v_pbase bigint; v_parc bigint; v_pparc bigint; cb record; i int := 0;
BEGIN
  IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, 'coordenador'::app_role) OR public.has_role(v_uid, 'professor'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para vender planos 2027';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  IF v_desc_c < 0 THEN RAISE EXCEPTION 'Desconto inválido'; END IF;
  v_teste := EXISTS (
    SELECT 1 FROM public.sistema_config sc
    WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
      AND jsonb_typeof(sc.valor) = 'array'
      AND sc.valor ? v_aluno::text
  );
  r := public.fn_venda_2027_gravar(p, v_uid, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END, 'manual', false);
  IF v_desc_c = 0 OR COALESCE((r->>'repetida')::boolean, false) THEN RETURN r; END IF;

  v_venda := (r->>'venda_id')::uuid; v_plano := (r->>'plano_id')::uuid; v_contrato := (r->>'contrato_id')::uuid;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid;
  v_ehstart := c.familia = 'start_2027';
  v_ehmensal := c.modalidade_cobranca = 'recorrencia_mensal';
  v_ciclo := v_ehstart OR (c.familia = 'consultoria_2027' AND v_ehmensal);

  IF v_ehmensal THEN
    SELECT * INTO cb FROM public.cobrancas WHERE contrato_id = v_contrato AND numero_ciclo = 1;
    IF v_desc_c >= round(cb.valor * 100) THEN RAISE EXCEPTION 'Desconto maior que a mensalidade'; END IF;
    UPDATE public.cobrancas SET valor = (round(cb.valor * 100) - v_desc_c) / 100.0,
      composicao = jsonb_set(COALESCE(composicao, '{}'::jsonb), '{plano}', to_jsonb((round(cb.valor * 100) - v_desc_c) / 100.0))
    WHERE id = cb.id;
    IF v_ciclo AND v_rec THEN
      UPDATE public.planos SET desconto_recorrente = v_desc_c / 100.0 WHERE id = v_plano;
    END IF;
  ELSE
    SELECT round(valor_base * 100), round(valor_cobrado * 100) - round(valor_base * 100), parcelas
      INTO v_plano_c, v_serv_c, v_n FROM public.contratos WHERE id = v_contrato;
    IF v_desc_c >= v_plano_c THEN RAISE EXCEPTION 'Desconto maior que o valor do plano'; END IF;
    v_novo_c := v_plano_c - v_desc_c;
    v_base := (v_novo_c + v_serv_c) / v_n;
    v_pbase := v_novo_c / v_n;

    -- Antes havia um FOR ... LOOP com um UPDATE por parcela. Cada UPDATE dispara
    -- o gatilho de statement trg_cobrancas_sync_receitas, que reconstrói a tabela
    -- receitas inteira (~0,8s). Com 12 parcelas estourava o statement_timeout.
    -- Agora é um único UPDATE, com a mesma aritmética e o mesmo ajuste de
    -- centavos na última parcela; o gatilho dispara uma vez só.
    UPDATE public.cobrancas cb2
    SET valor = x.parcela_total / 100.0,
        composicao = jsonb_set(
          jsonb_set(COALESCE(cb2.composicao, '{}'::jsonb), '{plano}', to_jsonb(x.parcela_plano / 100.0)),
          '{servicos}', to_jsonb((x.parcela_total - x.parcela_plano) / 100.0))
    FROM (
      SELECT c2.id,
             CASE WHEN c2.numero_ciclo = v_n THEN (v_novo_c + v_serv_c) - v_base  * (v_n - 1) ELSE v_base  END AS parcela_total,
             CASE WHEN c2.numero_ciclo = v_n THEN v_novo_c              - v_pbase * (v_n - 1) ELSE v_pbase END AS parcela_plano
      FROM public.cobrancas c2
      WHERE c2.contrato_id = v_contrato AND c2.numero_ciclo BETWEEN 1 AND v_n
    ) x
    WHERE cb2.id = x.id;
  END IF;

  UPDATE public.vendas SET desconto = v_desc_c / 100.0, valor_final = valor - v_desc_c / 100.0 WHERE id = v_venda;
  UPDATE public.contratos SET valor_cobrado = valor_cobrado - v_desc_c / 100.0 WHERE id = v_contrato;
  RETURN r || jsonb_build_object('desconto', v_desc_c / 100.0, 'desconto_recorrente', v_ciclo AND v_rec);
END;
$function$;