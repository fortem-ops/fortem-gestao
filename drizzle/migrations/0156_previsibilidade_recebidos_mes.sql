CREATE OR REPLACE VIEW public.vw_recebidos_periodo AS
WITH taxa_vista AS (
  SELECT COALESCE(t.taxa_percentual, 0) AS taxa, cfg.bandeira_padrao
  FROM public.adquirentes_config cfg
  LEFT JOIN public.adquirentes_taxas t ON t.adquirente = cfg.adquirente AND t.bandeira = cfg.bandeira_padrao AND t.modalidade = 'credito_vista'::public.adquirente_modalidade
  WHERE cfg.adquirente = 'rede'
  LIMIT 1
)
SELECT ('recebido:' || cb.id::text) AS id,
  cb.aluno_id, a.nome AS aluno_nome, 'mensalidade'::text AS origem,
  COALESCE(c.plano_tipo, 'Mensalidade') AS descricao,
  COALESCE(cb.forma_pagamento, c.forma_pagamento) AS forma_pagamento,
  CASE WHEN c.forma_pagamento IN ('cartao_recorrencia','maquina_credito') THEN tv.bandeira_padrao END AS bandeira,
  cb.valor AS valor_bruto,
  CASE WHEN c.forma_pagamento IN ('cartao_recorrencia','maquina_credito') THEN COALESCE(tv.taxa,0) ELSE 0 END AS taxa_percentual,
  round(cb.valor * (1 - (CASE WHEN c.forma_pagamento IN ('cartao_recorrencia','maquina_credito') THEN COALESCE(tv.taxa,0) ELSE 0 END) / 100.0), 2) AS valor_liquido,
  cb.data_vencimento,
  cb.data_pagamento AS data_recebimento_prevista,
  false AS ja_cobrado,
  true AS recebido
FROM public.cobrancas cb
JOIN public.contratos c ON c.id = cb.contrato_id
JOIN public.alunos a ON a.id = cb.aluno_id
LEFT JOIN taxa_vista tv ON true
WHERE cb.status = 'pago' AND cb.valor > 0
  AND cb.origem IS DISTINCT FROM 'teste_2027'
  AND cb.data_pagamento >= date_trunc('month', CURRENT_DATE)::date
  AND cb.data_pagamento <= CURRENT_DATE
  AND c.plano_tipo <> ALL (ARRAY['gympass','wellhub','totalpass','outro'])
  AND NOT EXISTS (SELECT 1 FROM public.vw_recebiveis_previstos_cartao_parcelado k WHERE k.cobranca_id = cb.id)
UNION ALL
SELECT ('recebido-cartao:' || k.cobranca_id::text), k.aluno_id, k.aluno_nome, k.origem,
  COALESCE(k.plano_tipo, 'Mensalidade') || ' (' || k.numero_parcela || '/' || k.total_parcelas || ')',
  'cartao_credito', k.bandeira, k.valor_bruto, k.taxa_percentual, k.valor_liquido,
  k.data_recebimento_prevista, k.data_recebimento_prevista, true, true
FROM public.vw_recebiveis_previstos_cartao_parcelado k
WHERE k.data_recebimento_prevista >= date_trunc('month', CURRENT_DATE)::date
  AND k.data_recebimento_prevista < CURRENT_DATE
UNION ALL
SELECT ('recebido-servico:' || v.id::text), v.aluno_id, a.nome, 'servico',
  COALESCE(v.nome_snapshot, 'Serviço'),
  COALESCE(v.forma_pagamento, v.modalidade_pagamento), NULL::text,
  COALESCE(v.valor_final, v.valor)::numeric, 0::numeric, COALESCE(v.valor_final, v.valor)::numeric,
  v.data_venda, v.data_venda, false, true
FROM public.vendas v
JOIN public.alunos a ON a.id = v.aluno_id
WHERE v.tipo = 'servico'::public.venda_tipo AND v.status_pagamento::text = 'pago'
  AND v.origem IS DISTINCT FROM 'teste_2027'
  AND COALESCE(v.valor_final, v.valor) > 0
  AND v.data_venda >= date_trunc('month', CURRENT_DATE)::date AND v.data_venda <= CURRENT_DATE
  AND NOT (COALESCE(v.parcelas,1) > 1 AND COALESCE(v.forma_pagamento, v.modalidade_pagamento) IN ('cartao_credito','cartao_parcelado'));

REVOKE ALL ON public.vw_recebidos_periodo FROM anon;
GRANT SELECT ON public.vw_recebidos_periodo TO authenticated;
GRANT ALL ON public.vw_recebidos_periodo TO service_role;