CREATE OR REPLACE FUNCTION public.fn_previsibilidade_projecao()
 RETURNS TABLE(mes text, renovacao_liquido numeric, vendas_novas_liquido numeric, taxa_renovacao numeric, media_vendas_novas numeric, taxa_cartao numeric)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  WITH excl AS (SELECT ARRAY['gympass','wellhub','totalpass','outro']::text[] AS t),
  taxa AS (
    SELECT COALESCE((SELECT t.taxa_percentual FROM adquirentes_config cfg
      JOIN adquirentes_taxas t ON t.adquirente='rede' AND t.bandeira=cfg.bandeira_padrao AND t.modalidade='credito_7_12x'
      WHERE cfg.adquirente='rede' LIMIT 1), 0) AS pct
  ),
  fim_hist AS (
    SELECT c.id, c.aluno_id, c.data_fim FROM contratos c, excl
    WHERE c.data_fim BETWEEN CURRENT_DATE - 365 AND CURRENT_DATE - 31
      AND c.plano_tipo <> ALL (excl.t) AND c.plano_tipo <> 'corrida' AND COALESCE(c.valor_cobrado,0) > 0
  ),
  tx AS (
    SELECT CASE WHEN count(*) = 0 THEN 0::numeric ELSE round(
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM contratos n, excl WHERE n.aluno_id=f.aluno_id AND n.id<>f.id
        AND n.data_inicio BETWEEN f.data_fim - 30 AND f.data_fim + 30 AND n.plano_tipo <> ALL (excl.t) AND n.plano_tipo <> 'corrida'))::numeric
      / count(*), 4) END AS taxa
    FROM fim_hist f
  ),
  vencendo AS (
    SELECT c.id, c.data_fim,
      (SELECT avg(cb.valor) FROM cobrancas cb WHERE cb.contrato_id=c.id AND cb.numero_ciclo<>999 AND cb.valor>0 AND cb.origem IS DISTINCT FROM 'teste_2027') AS mensal
    FROM contratos c, excl
    WHERE c.status='ativo' AND c.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + 365
      AND c.plano_tipo <> ALL (excl.t) AND c.plano_tipo <> 'corrida'
      AND NOT EXISTS (SELECT 1 FROM contratos n WHERE n.aluno_id=c.aluno_id AND n.id<>c.id AND n.data_inicio >= c.data_fim - 30
        AND n.status <> 'cancelado' AND n.plano_tipo <> ALL (excl.t) AND n.plano_tipo <> 'corrida')
  ),
  novas AS (
    SELECT COALESCE(sum(COALESCE(v.valor_final, v.valor)),0) / 6.0 AS media
    FROM vendas v, excl
    WHERE v.status_pagamento='pago' AND v.origem IS DISTINCT FROM 'teste_2027'
      AND v.data_venda >= date_trunc('month', CURRENT_DATE) - interval '6 months' AND v.data_venda < date_trunc('month', CURRENT_DATE)
      AND COALESCE(v.valor_final, v.valor) > 0
      AND NOT EXISTS (SELECT 1 FROM contratos c WHERE c.aluno_id=v.aluno_id AND c.data_inicio < v.data_venda - 30 AND c.plano_tipo <> ALL (excl.t))
      AND NOT EXISTS (SELECT 1 FROM vendas o WHERE o.aluno_id=v.aluno_id AND o.id<>v.id AND o.status_pagamento='pago' AND o.data_venda < v.data_venda - 30)
  ),
  meses AS (
    SELECT (date_trunc('month', CURRENT_DATE) + (i || ' months')::interval)::date AS m FROM generate_series(0, 11) i
  )
  SELECT to_char(ms.m, 'YYYY-MM'),
    round(COALESCE((SELECT sum(ve.mensal) FROM vencendo ve WHERE ve.mensal IS NOT NULL AND ms.m > ve.data_fim), 0)
      * tx.taxa * (1 - taxa.pct/100.0), 2),
    CASE WHEN ms.m > CURRENT_DATE THEN round(novas.media * (1 - taxa.pct/100.0), 2) ELSE 0 END,
    tx.taxa, round(novas.media, 2), taxa.pct
  FROM meses ms, tx, novas, taxa
  ORDER BY 1;
$function$;
GRANT EXECUTE ON FUNCTION public.fn_previsibilidade_projecao() TO authenticated;