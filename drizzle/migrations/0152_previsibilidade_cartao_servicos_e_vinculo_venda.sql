CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_cartao_parcelado AS
WITH vp AS (
         SELECT DISTINCT ON (c_1.id) c_1.id AS contrato_id,
            v.id AS venda_id,
            v.data_venda
           FROM contratos c_1
             JOIN vendas v ON v.cobranca_id IS NOT NULL AND (v.cobranca_id IN ( SELECT cobrancas.id
                   FROM cobrancas
                  WHERE cobrancas.contrato_id = c_1.id)) OR v.aluno_id = c_1.aluno_id AND v.plano_id = c_1.plano_id OR (EXISTS ( SELECT 1 FROM cobrancas cx WHERE cx.contrato_id = c_1.id AND (cx.composicao ->> 'venda_id'::text) = v.id::text))
          WHERE v.status_pagamento::text = 'pago'::text AND (COALESCE(v.modalidade_pagamento, v.forma_pagamento) = ANY (ARRAY['cartao_parcelado'::text, 'cartao_credito'::text])) AND v.origem IS DISTINCT FROM 'teste_2027'::text AND (c_1.plano_tipo <> ALL (ARRAY['gympass'::text, 'wellhub'::text, 'totalpass'::text, 'outro'::text]))
          ORDER BY c_1.id, v.data_venda DESC, v.created_at DESC
        ), parc AS (
         SELECT cb.id AS cobranca_id,
            cb.contrato_id,
            cb.aluno_id,
            cb.valor AS valor_bruto,
            vp.data_venda,
            row_number() OVER (PARTITION BY cb.contrato_id ORDER BY cb.numero_ciclo, cb.data_vencimento)::integer AS n,
            count(*) OVER (PARTITION BY cb.contrato_id)::integer AS total
           FROM cobrancas cb
             JOIN vp ON vp.contrato_id = cb.contrato_id
          WHERE cb.status = 'pago'::text AND cb.numero_ciclo <> 999 AND cb.valor > 0::numeric AND cb.origem IS DISTINCT FROM 'teste_2027'::text AND cb.data_pagamento >= vp.data_venda
        )
 SELECT p.cobranca_id,
    p.contrato_id,
    p.aluno_id,
    a.nome AS aluno_nome,
    'mensalidade'::text AS origem,
    c.plano_tipo,
    p.n AS numero_parcela,
    p.total AS total_parcelas,
    p.valor_bruto,
    COALESCE(t.taxa_percentual, 0::numeric) AS taxa_percentual,
    round(p.valor_bruto * (1::numeric - COALESCE(t.taxa_percentual, 0::numeric) / 100.0), 2) AS valor_liquido,
    fn_fin_proximo_dia_util((p.data_venda + make_interval(months => p.n))::date + 1) AS data_recebimento_prevista,
    cfg.bandeira_padrao AS bandeira
   FROM parc p
     JOIN alunos a ON a.id = p.aluno_id
     JOIN contratos c ON c.id = p.contrato_id
     LEFT JOIN adquirentes_config cfg ON cfg.adquirente = 'rede'::text
     LEFT JOIN adquirentes_taxas t ON t.adquirente = 'rede'::text AND t.bandeira = cfg.bandeira_padrao AND t.modalidade =
        CASE
            WHEN p.total <= 1 THEN 'credito_vista'::text
            WHEN p.total <= 6 THEN 'credito_2_6x'::text
            ELSE 'credito_7_12x'::text
        END::adquirente_modalidade;
CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_futuros_cartao AS
SELECT cobranca_id,
    contrato_id,
    aluno_id,
    aluno_nome,
    origem,
    plano_tipo,
    numero_parcela,
    total_parcelas,
    valor_bruto,
    taxa_percentual,
    valor_liquido,
    data_recebimento_prevista,
    bandeira
   FROM vw_recebiveis_previstos_cartao_parcelado
  WHERE data_recebimento_prevista >= CURRENT_DATE
UNION ALL
 SELECT md5(s.venda_id::text || ':' || s.n)::uuid AS cobranca_id,
    NULL::uuid AS contrato_id, s.aluno_id, s.aluno_nome, 'servico'::text AS origem,
    s.nome_snapshot AS plano_tipo, s.n::integer AS numero_parcela, s.total::integer AS total_parcelas, s.valor_bruto::numeric(10,2) AS valor_bruto,
    COALESCE(t.taxa_percentual, 0::numeric) AS taxa_percentual,
    round(s.valor_bruto * (1::numeric - COALESCE(t.taxa_percentual, 0::numeric) / 100.0), 2) AS valor_liquido,
    s.data_prev AS data_recebimento_prevista, cfg.bandeira_padrao AS bandeira
   FROM ( SELECT v.id AS venda_id, v.aluno_id, a.nome AS aluno_nome, v.nome_snapshot, n.n, v.parcelas AS total,
            CASE WHEN n.n = v.parcelas THEN COALESCE(v.valor_final, v.valor) - round(COALESCE(v.valor_final, v.valor) / v.parcelas::numeric, 2) * (v.parcelas - 1)
                 ELSE round(COALESCE(v.valor_final, v.valor) / v.parcelas::numeric, 2) END AS valor_bruto,
            fn_fin_proximo_dia_util((v.data_venda + make_interval(months => n.n))::date + 1) AS data_prev
           FROM vendas v JOIN alunos a ON a.id = v.aluno_id
           CROSS JOIN LATERAL generate_series(1, v.parcelas) n(n)
          WHERE v.tipo = 'servico'::venda_tipo AND v.status_pagamento::text = 'pago'::text
            AND v.origem IS DISTINCT FROM 'teste_2027'::text AND COALESCE(v.parcelas, 1) > 1
            AND COALESCE(v.valor_final, v.valor) > 0::numeric
            AND (COALESCE(v.forma_pagamento, v.modalidade_pagamento) = ANY (ARRAY['cartao_credito'::text, 'cartao_parcelado'::text]))) s
     LEFT JOIN adquirentes_config cfg ON cfg.adquirente = 'rede'::text
     LEFT JOIN adquirentes_taxas t ON t.adquirente = 'rede'::text AND t.bandeira = cfg.bandeira_padrao AND t.modalidade =
        CASE WHEN s.total <= 6 THEN 'credito_2_6x'::text ELSE 'credito_7_12x'::text END::adquirente_modalidade
  WHERE s.data_prev >= CURRENT_DATE;