ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS bandeira text NULL,
  ADD COLUMN IF NOT EXISTS parcelas_cartao smallint NULL;

ALTER TABLE public.cobrancas
  DROP CONSTRAINT IF EXISTS cobrancas_parcelas_cartao_check;

ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_parcelas_cartao_check
  CHECK (parcelas_cartao IS NULL OR (parcelas_cartao >= 1 AND parcelas_cartao <= 12));

CREATE OR REPLACE VIEW public.vw_recebidos_periodo
WITH (security_invoker = on) AS
WITH cfg AS (
  SELECT adquirente, bandeira_padrao
  FROM public.adquirentes_config
  WHERE adquirente = 'rede'::text
  LIMIT 1
),
base_mensalidades AS (
  SELECT
    cb.id,
    cb.aluno_id,
    a.nome AS aluno_nome,
    COALESCE(c.plano_tipo, 'Mensalidade'::text) AS descricao,
    COALESCE(cb.forma_pagamento, c.forma_pagamento) AS forma_efetiva,
    cb.bandeira AS cb_bandeira,
    cb.parcelas_cartao,
    cb.valor,
    cb.data_vencimento,
    cb.data_pagamento,
    cfg.adquirente,
    cfg.bandeira_padrao,
    CASE
      WHEN COALESCE(cb.forma_pagamento, c.forma_pagamento) = ANY (ARRAY['maquina_debito'::text, 'cartao_debito'::text, 'debito'::text])
        THEN 'debito'::public.adquirente_modalidade
      WHEN COALESCE(cb.forma_pagamento, c.forma_pagamento) = ANY (ARRAY['cartao_recorrencia'::text, 'maquina_credito'::text, 'cartao_credito_online'::text])
        THEN CASE
          WHEN COALESCE(cb.parcelas_cartao, 1) >= 7 THEN 'credito_7_12x'::public.adquirente_modalidade
          WHEN COALESCE(cb.parcelas_cartao, 1) >= 2 THEN 'credito_2_6x'::public.adquirente_modalidade
          ELSE 'credito_vista'::public.adquirente_modalidade
        END
      ELSE NULL::public.adquirente_modalidade
    END AS modalidade_adquirente
  FROM public.cobrancas cb
    JOIN public.contratos c ON c.id = cb.contrato_id
    JOIN public.alunos a ON a.id = cb.aluno_id
    LEFT JOIN cfg ON true
  WHERE cb.status = 'pago'::text
    AND cb.valor > 0::numeric
    AND cb.origem IS DISTINCT FROM 'teste_2027'::text
    AND cb.data_pagamento >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date
    AND cb.data_pagamento <= CURRENT_DATE
    AND (c.plano_tipo <> ALL (ARRAY['gympass'::text, 'wellhub'::text, 'totalpass'::text, 'outro'::text]))
    AND NOT (EXISTS (
      SELECT 1
      FROM public.vw_recebiveis_previstos_cartao_parcelado k
      WHERE k.cobranca_id = cb.id
    ))
)
SELECT
  'recebido:'::text || bm.id::text AS id,
  bm.aluno_id,
  bm.aluno_nome,
  'mensalidade'::text AS origem,
  bm.descricao,
  bm.forma_efetiva AS forma_pagamento,
  CASE
    WHEN bm.modalidade_adquirente IS NOT NULL THEN COALESCE(bm.cb_bandeira, bm.bandeira_padrao)
    ELSE NULL::text
  END AS bandeira,
  bm.valor AS valor_bruto,
  CASE
    WHEN bm.modalidade_adquirente IS NOT NULL THEN COALESCE(tx.taxa_percentual, 0::numeric)
    ELSE 0::numeric
  END AS taxa_percentual,
  round(
    bm.valor * (
      1::numeric - (
        CASE
          WHEN bm.modalidade_adquirente IS NOT NULL THEN COALESCE(tx.taxa_percentual, 0::numeric)
          ELSE 0::numeric
        END
      ) / 100.0
    ),
    2
  ) AS valor_liquido,
  bm.data_vencimento,
  bm.data_pagamento AS data_recebimento_prevista,
  false AS ja_cobrado,
  true AS recebido
FROM base_mensalidades bm
  LEFT JOIN public.adquirentes_taxas tx
    ON tx.adquirente = bm.adquirente
   AND tx.bandeira = COALESCE(bm.cb_bandeira, bm.bandeira_padrao)
   AND tx.modalidade = bm.modalidade_adquirente
UNION ALL
SELECT
  'recebido-cartao:'::text || k.cobranca_id::text AS id,
  k.aluno_id,
  k.aluno_nome,
  k.origem,
  ((((COALESCE(k.plano_tipo, 'Mensalidade'::text) || ' ('::text) || k.numero_parcela) || '/'::text) || k.total_parcelas) || ')'::text AS descricao,
  'cartao_credito'::text AS forma_pagamento,
  k.bandeira,
  k.valor_bruto,
  k.taxa_percentual,
  k.valor_liquido,
  k.data_recebimento_prevista AS data_vencimento,
  k.data_recebimento_prevista,
  true AS ja_cobrado,
  true AS recebido
FROM public.vw_recebiveis_previstos_cartao_parcelado k
WHERE k.data_recebimento_prevista >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date
  AND k.data_recebimento_prevista < CURRENT_DATE
UNION ALL
SELECT
  'recebido-servico:'::text || v.id::text AS id,
  v.aluno_id,
  a.nome AS aluno_nome,
  'servico'::text AS origem,
  COALESCE(v.nome_snapshot, 'Serviço'::text) AS descricao,
  COALESCE(v.forma_pagamento, v.modalidade_pagamento) AS forma_pagamento,
  NULL::text AS bandeira,
  COALESCE(v.valor_final, v.valor) AS valor_bruto,
  0::numeric AS taxa_percentual,
  COALESCE(v.valor_final, v.valor) AS valor_liquido,
  v.data_venda AS data_vencimento,
  v.data_venda AS data_recebimento_prevista,
  false AS ja_cobrado,
  true AS recebido
FROM public.vendas v
  JOIN public.alunos a ON a.id = v.aluno_id
WHERE v.tipo = 'servico'::public.venda_tipo
  AND v.status_pagamento::text = 'pago'::text
  AND v.origem IS DISTINCT FROM 'teste_2027'::text
  AND COALESCE(v.valor_final, v.valor) > 0::numeric
  AND v.data_venda >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date
  AND v.data_venda <= CURRENT_DATE
  AND NOT (
    COALESCE(v.parcelas, 1) > 1
    AND (COALESCE(v.forma_pagamento, v.modalidade_pagamento) = ANY (ARRAY['cartao_credito'::text, 'cartao_parcelado'::text]))
  );