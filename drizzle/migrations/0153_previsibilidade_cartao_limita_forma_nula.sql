CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_cartao_parcelado AS
WITH vp AS (
         SELECT DISTINCT ON (c_1.id) c_1.id AS contrato_id,
            v.id AS venda_id,
            v.data_venda
           FROM contratos c_1
             JOIN vendas v ON v.cobranca_id IS NOT NULL AND (v.cobranca_id IN ( SELECT cobrancas.id
                   FROM cobrancas
                  WHERE cobrancas.contrato_id = c_1.id)) OR v.aluno_id = c_1.aluno_id AND v.plano_id = c_1.plano_id OR (EXISTS ( SELECT 1 FROM cobrancas cx WHERE cx.contrato_id = c_1.id AND (cx.composicao ->> 'venda_id'::text) = v.id::text))
          WHERE v.status_pagamento::text = 'pago'::text AND ((v.modalidade_pagamento = ANY (ARRAY['cartao_parcelado'::text, 'cartao_credito'::text])) OR v.modalidade_pagamento IS NULL AND v.forma_pagamento = 'cartao_parcelado'::text) AND v.origem IS DISTINCT FROM 'teste_2027'::text AND (c_1.plano_tipo <> ALL (ARRAY['gympass'::text, 'wellhub'::text, 'totalpass'::text, 'outro'::text]))
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