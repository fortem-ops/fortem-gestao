CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_cartao_parcelado AS
WITH vp AS (
  SELECT DISTINCT ON (c.id) c.id AS contrato_id, v.id AS venda_id, v.data_venda
  FROM contratos c
  JOIN vendas v ON (v.cobranca_id IS NOT NULL AND v.cobranca_id IN (SELECT id FROM cobrancas WHERE contrato_id = c.id))
     OR (v.aluno_id = c.aluno_id AND v.plano_id = c.plano_id)
  WHERE v.status_pagamento::text = 'pago'
    AND v.modalidade_pagamento IN ('cartao_parcelado','cartao_credito')
    AND v.origem IS DISTINCT FROM 'teste_2027'
    AND c.plano_tipo <> ALL (ARRAY['gympass','wellhub','totalpass','outro'])
  ORDER BY c.id, v.data_venda DESC, v.created_at DESC
), parc AS (
  SELECT cb.id AS cobranca_id, cb.contrato_id, cb.aluno_id, cb.valor AS valor_bruto, vp.data_venda,
    (row_number() OVER (PARTITION BY cb.contrato_id ORDER BY cb.numero_ciclo, cb.data_vencimento))::int AS n,
    (count(*) OVER (PARTITION BY cb.contrato_id))::int AS total
  FROM cobrancas cb JOIN vp ON vp.contrato_id = cb.contrato_id
  WHERE cb.status = 'pago' AND cb.numero_ciclo <> 999 AND cb.valor > 0
    AND cb.origem IS DISTINCT FROM 'teste_2027' AND cb.data_pagamento >= vp.data_venda
)
SELECT p.cobranca_id, p.contrato_id, p.aluno_id, a.nome AS aluno_nome,
  'mensalidade'::text AS origem, c.plano_tipo, p.n AS numero_parcela, p.total AS total_parcelas,
  p.valor_bruto,
  COALESCE(t.taxa_percentual, 0) AS taxa_percentual,
  round(p.valor_bruto * (1 - COALESCE(t.taxa_percentual, 0) / 100.0), 2) AS valor_liquido,
  fn_fin_proximo_dia_util(p.data_venda::date + p.n * 30) AS data_recebimento_prevista,
  cfg.bandeira_padrao AS bandeira
FROM parc p
JOIN alunos a ON a.id = p.aluno_id
JOIN contratos c ON c.id = p.contrato_id
LEFT JOIN adquirentes_config cfg ON cfg.adquirente = 'rede'
LEFT JOIN adquirentes_taxas t ON t.adquirente = 'rede' AND t.bandeira = cfg.bandeira_padrao
  AND t.modalidade = (CASE WHEN p.total <= 1 THEN 'credito_vista' WHEN p.total <= 6 THEN 'credito_2_6x' ELSE 'credito_7_12x' END)::adquirente_modalidade;

CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_futuros_cartao AS
SELECT * FROM public.vw_recebiveis_previstos_cartao_parcelado WHERE data_recebimento_prevista >= CURRENT_DATE;

GRANT SELECT ON public.vw_recebiveis_previstos_cartao_parcelado, public.vw_recebiveis_previstos_futuros_cartao TO authenticated;
GRANT ALL ON public.vw_recebiveis_previstos_cartao_parcelado, public.vw_recebiveis_previstos_futuros_cartao TO service_role;
ALTER VIEW public.vw_recebiveis_previstos_cartao_parcelado SET (security_invoker = true);
ALTER VIEW public.vw_recebiveis_previstos_futuros_cartao SET (security_invoker = true);

CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_todos AS
 SELECT 'mensalidade:'::text || m.cobranca_id::text AS id, m.aluno_id, m.aluno_nome, m.origem,
    COALESCE(m.plano_tipo, 'Mensalidade'::text) AS descricao, m.forma_pagamento, m.bandeira, m.bandeira_de_cartao_salvo,
    m.valor_bruto, m.taxa_percentual, m.valor_liquido, m.data_vencimento, m.data_recebimento_prevista, false AS ja_cobrado
   FROM vw_recebiveis_previstos_mensalidades m
UNION ALL
 SELECT (('servico:'::text || s.venda_id::text) || ':'::text) || s.numero_parcela AS id, s.aluno_id, s.aluno_nome, s.origem,
    COALESCE(s.descricao, 'Serviço'::text) || CASE WHEN s.total_parcelas > 1 THEN ' (' || s.numero_parcela || '/' || s.total_parcelas || ')' ELSE '' END,
    s.forma_pagamento, s.bandeira, false, s.valor_bruto, s.taxa_percentual, s.valor_liquido, s.data_vencimento, s.data_recebimento_prevista, false
   FROM vw_recebiveis_previstos_servicos s
UNION ALL
 SELECT 'produto:'::text || p.pedido_id::text, p.aluno_id, p.aluno_nome, p.origem, 'Produto'::text, p.forma_pagamento, p.bandeira, false,
    p.valor_bruto, p.taxa_percentual, p.valor_liquido, p.data_vencimento, p.data_recebimento_prevista, false
   FROM vw_recebiveis_previstos_produtos p
UNION ALL
 SELECT 'cartao:'::text || k.cobranca_id::text, k.aluno_id, k.aluno_nome, k.origem,
    COALESCE(k.plano_tipo, 'Mensalidade') || ' (' || k.numero_parcela || '/' || k.total_parcelas || ')',
    'cartao_credito'::text, k.bandeira, false, k.valor_bruto, k.taxa_percentual, k.valor_liquido,
    k.data_recebimento_prevista, k.data_recebimento_prevista, true
   FROM vw_recebiveis_previstos_futuros_cartao k;

CREATE OR REPLACE FUNCTION public.fn_previsibilidade_resumo_mensal()
 RETURNS TABLE(mes text, origem text, qtd bigint, total_bruto numeric, total_liquido numeric)
 LANGUAGE sql STABLE SET search_path = public
AS $function$
  WITH tudo AS (
    SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_mensalidades
    UNION ALL SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_servicos
    UNION ALL SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_produtos
    UNION ALL SELECT origem, data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_futuros_cartao
  )
  SELECT to_char(data_recebimento_prevista, 'YYYY-MM') AS mes, origem,
    count(*) AS qtd, sum(valor_bruto) AS total_bruto, sum(valor_liquido) AS total_liquido
  FROM tudo GROUP BY 1, 2 ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.fn_previsibilidade_dia_a_dia(p_inicio date, p_fim date)
 RETURNS TABLE(dia date, dia_util boolean, previsto_bruto numeric, previsto_liquido numeric, realizado_bruto numeric)
 LANGUAGE sql STABLE SET search_path = public
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
      UNION ALL SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_futuros_cartao
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
 LANGUAGE sql STABLE SET search_path = public
AS $function$
  WITH tudo AS (
    SELECT data_vencimento, data_recebimento_prevista, valor_bruto, valor_liquido, false AS ja_cobrado FROM vw_recebiveis_previstos_mensalidades
    UNION ALL SELECT data_vencimento, data_recebimento_prevista, valor_bruto, valor_liquido, false FROM vw_recebiveis_previstos_servicos
    UNION ALL SELECT data_vencimento, data_recebimento_prevista, valor_bruto, valor_liquido, false FROM vw_recebiveis_previstos_produtos
    UNION ALL SELECT data_recebimento_prevista, data_recebimento_prevista, valor_bruto, valor_liquido, true FROM vw_recebiveis_previstos_futuros_cartao
  )
  SELECT
    COALESCE(sum(valor_bruto) FILTER (WHERE date_trunc('month', data_recebimento_prevista) = date_trunc('month', CURRENT_DATE)), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE date_trunc('month', data_recebimento_prevista) = date_trunc('month', CURRENT_DATE)), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE data_recebimento_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 30), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE data_recebimento_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 60), 0),
    COALESCE(sum(valor_liquido) FILTER (WHERE data_recebimento_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 90), 0),
    COALESCE(sum(valor_bruto) FILTER (WHERE data_vencimento < CURRENT_DATE AND NOT ja_cobrado), 0),
    COALESCE(count(*) FILTER (WHERE data_vencimento < CURRENT_DATE AND NOT ja_cobrado), 0)
  FROM tudo;
$function$;