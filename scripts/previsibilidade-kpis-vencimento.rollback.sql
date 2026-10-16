-- Rollback: KPIs pela data de recebimento
CREATE OR REPLACE FUNCTION public.fn_previsibilidade_kpis()
 RETURNS TABLE(mes_atual_bruto numeric, mes_atual_liquido numeric, proximos_30_liquido numeric, proximos_60_liquido numeric, proximos_90_liquido numeric, em_atraso_bruto numeric, em_atraso_qtd bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
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
$function$

