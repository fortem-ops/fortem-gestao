-- Rollback: restaura definições anteriores (0150)
DROP VIEW IF EXISTS public.vw_recebiveis_previstos_todos;
CREATE VIEW public.vw_recebiveis_previstos_todos AS
 SELECT 'mensalidade:'::text || vw_recebiveis_previstos_mensalidades.cobranca_id::text AS id,
    vw_recebiveis_previstos_mensalidades.aluno_id,
    vw_recebiveis_previstos_mensalidades.aluno_nome,
    vw_recebiveis_previstos_mensalidades.origem,
    COALESCE(vw_recebiveis_previstos_mensalidades.plano_tipo, 'Mensalidade'::text) AS descricao,
    vw_recebiveis_previstos_mensalidades.forma_pagamento,
    vw_recebiveis_previstos_mensalidades.bandeira,
    vw_recebiveis_previstos_mensalidades.bandeira_de_cartao_salvo,
    vw_recebiveis_previstos_mensalidades.valor_bruto,
    vw_recebiveis_previstos_mensalidades.taxa_percentual,
    vw_recebiveis_previstos_mensalidades.valor_liquido,
    vw_recebiveis_previstos_mensalidades.data_vencimento,
    vw_recebiveis_previstos_mensalidades.data_recebimento_prevista
   FROM vw_recebiveis_previstos_mensalidades
UNION ALL
 SELECT (('servico:'::text || vw_recebiveis_previstos_servicos.venda_id::text) || ':'::text) || vw_recebiveis_previstos_servicos.numero_parcela AS id,
    vw_recebiveis_previstos_servicos.aluno_id,
    vw_recebiveis_previstos_servicos.aluno_nome,
    vw_recebiveis_previstos_servicos.origem,
    COALESCE(vw_recebiveis_previstos_servicos.descricao, 'Serviço'::text) ||
        CASE
            WHEN vw_recebiveis_previstos_servicos.total_parcelas > 1 THEN (((' ('::text || vw_recebiveis_previstos_servicos.numero_parcela) || '/'::text) || vw_recebiveis_previstos_servicos.total_parcelas) || ')'::text
            ELSE ''::text
        END AS descricao,
    vw_recebiveis_previstos_servicos.forma_pagamento,
    vw_recebiveis_previstos_servicos.bandeira,
    false AS bandeira_de_cartao_salvo,
    vw_recebiveis_previstos_servicos.valor_bruto,
    vw_recebiveis_previstos_servicos.taxa_percentual,
    vw_recebiveis_previstos_servicos.valor_liquido,
    vw_recebiveis_previstos_servicos.data_vencimento,
    vw_recebiveis_previstos_servicos.data_recebimento_prevista
   FROM vw_recebiveis_previstos_servicos
UNION ALL
 SELECT 'produto:'::text || vw_recebiveis_previstos_produtos.pedido_id::text AS id,
    vw_recebiveis_previstos_produtos.aluno_id,
    vw_recebiveis_previstos_produtos.aluno_nome,
    vw_recebiveis_previstos_produtos.origem,
    'Produto'::text AS descricao,
    vw_recebiveis_previstos_produtos.forma_pagamento,
    vw_recebiveis_previstos_produtos.bandeira,
    false AS bandeira_de_cartao_salvo,
    vw_recebiveis_previstos_produtos.valor_bruto,
    vw_recebiveis_previstos_produtos.taxa_percentual,
    vw_recebiveis_previstos_produtos.valor_liquido,
    vw_recebiveis_previstos_produtos.data_vencimento,
    vw_recebiveis_previstos_produtos.data_recebimento_prevista
   FROM vw_recebiveis_previstos_produtos;
GRANT SELECT ON public.vw_recebiveis_previstos_todos TO authenticated;
CREATE OR REPLACE FUNCTION public.fn_previsibilidade_resumo_mensal()
 RETURNS TABLE(mes text, origem text, qtd bigint, total_bruto numeric, total_liquido numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH tudo AS (
    SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_mensalidades
    UNION ALL
    SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_servicos
    UNION ALL
    SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_produtos
  )
  SELECT to_char(data_recebimento_prevista, 'YYYY-MM') AS mes, origem,
    count(*) AS qtd, sum(valor_bruto) AS total_bruto, sum(valor_liquido) AS total_liquido
  FROM tudo GROUP BY 1, 2 ORDER BY 1, 2;
$function$;


CREATE OR REPLACE FUNCTION public.fn_previsibilidade_dia_a_dia(p_inicio date, p_fim date)
 RETURNS TABLE(dia date, dia_util boolean, previsto_bruto numeric, previsto_liquido numeric, realizado_bruto numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH dias AS (
    SELECT d::date AS dia FROM generate_series(p_inicio, p_fim, interval '1 day') d
  ),
  previsto AS (
    SELECT data_recebimento_prevista AS dia, sum(valor_bruto) AS bruto, sum(valor_liquido) AS liquido
    FROM (
      SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_mensalidades
      UNION ALL SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_servicos
      UNION ALL SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_produtos
    ) t
    WHERE data_recebimento_prevista BETWEEN p_inicio AND p_fim
    GROUP BY 1
  ),
  realizado AS (
    SELECT cb.data_pagamento AS dia, sum(cb.valor) AS bruto
    FROM cobrancas cb JOIN contratos c ON c.id = cb.contrato_id
    WHERE cb.status = 'pago' AND cb.data_pagamento BETWEEN p_inicio AND p_fim
      AND c.plano_tipo NOT IN ('gympass','wellhub','totalpass','outro')
      AND cb.valor > 0 AND cb.origem IS DISTINCT FROM 'teste_2027'
    GROUP BY 1
  )
  SELECT d.dia, fn_fin_eh_dia_util(d.dia), COALESCE(p.bruto,0), COALESCE(p.liquido,0), COALESCE(r.bruto,0)
  FROM dias d
  LEFT JOIN previsto p ON p.dia = d.dia
  LEFT JOIN realizado r ON r.dia = d.dia
  ORDER BY d.dia;
$function$;


CREATE OR REPLACE FUNCTION public.fn_previsibilidade_kpis()
 RETURNS TABLE(mes_atual_bruto numeric, mes_atual_liquido numeric, proximos_30_liquido numeric, proximos_60_liquido numeric, proximos_90_liquido numeric, em_atraso_bruto numeric, em_atraso_qtd bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH tudo AS (
    SELECT data_vencimento, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_mensalidades
    UNION ALL
    SELECT data_vencimento, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_servicos
    UNION ALL
    SELECT data_vencimento, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_produtos
  )
  SELECT
    COALESCE(sum(valor_bruto) FILTER (WHERE date_trunc('month', data_recebimento_prevista) = date_trunc('month', CURRENT_DATE)), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE date_trunc('month', data_recebimento_prevista) = date_trunc('month', CURRENT_DATE)), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE data_recebimento_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 30), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE data_recebimento_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 60), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE data_recebimento_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 90), 0),
    COALESCE(sum(valor_bruto) FILTER (WHERE data_vencimento < CURRENT_DATE), 0),
    COALESCE(count(*) FILTER (WHERE data_vencimento < CURRENT_DATE), 0)
  FROM tudo;
$function$;

DROP VIEW IF EXISTS public.vw_recebiveis_previstos_futuros_cartao; DROP VIEW IF EXISTS public.vw_recebiveis_previstos_cartao_parcelado;
