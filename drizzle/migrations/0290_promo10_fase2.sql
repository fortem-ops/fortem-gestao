-- 1. Restringir privilégios de promo10_interesses
REVOKE ALL ON public.promo10_interesses FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.promo10_interesses TO authenticated;
GRANT ALL ON public.promo10_interesses TO service_role;

-- 2. Constante única do desconto de ex-aluno (R$ 300,00)
CREATE OR REPLACE FUNCTION public.fn_promo10_desconto_ex_aluno()
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 300.00::numeric(10,2);
$$;

REVOKE ALL ON FUNCTION public.fn_promo10_desconto_ex_aluno() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_desconto_ex_aluno() TO service_role;

-- 3. Atualizar fn_promo10_ofertas para usar fn_promo10_desconto_ex_aluno()
CREATE OR REPLACE FUNCTION public.fn_promo10_ofertas(
  p_aluno_id uuid,
  p_hoje date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_desc_ex_aluno numeric(10,2) := public.fn_promo10_desconto_ex_aluno();
  v_aluno record;
  v_plano public.planos;
  v_cat public.planos_catalogo;
  v_segmento text := 'sem_oferta';
  v_principal jsonb := '[]'::jsonb;
  v_corrida jsonb := null;
  v_freq_atual integer;
  v_nivel_atual integer;
  v_target integer;
  v_degraus integer;
  v_freq_label text;
  v_calc_promo jsonb;
  v_calc_cheio jsonb;
  v_agr text;
  v_eleg jsonb;
  v_ref_start3x numeric(10,2);
  v_item record;
  v_tem_historico boolean;
  v_tem_corrida boolean;
  v_corrida_nome text;
  v_corrida_valor numeric(10,2);
  v_sem_desc numeric(10,2);
  v_promo numeric(10,2);
BEGIN
  IF v_hoje > DATE '2026-12-31' THEN
    RETURN jsonb_build_object(
      'encerrada', true,
      'segmento', null,
      'principal', '[]'::jsonb,
      'corrida', null
    );
  END IF;

  SELECT id, COALESCE(is_equipe, false) AS is_equipe
    INTO v_aluno
    FROM public.alunos
   WHERE id = p_aluno_id;

  IF NOT FOUND OR v_aluno.is_equipe THEN
    RETURN jsonb_build_object(
      'encerrada', false,
      'segmento', CASE WHEN FOUND AND v_aluno.is_equipe THEN 'equipe' ELSE 'sem_oferta' END,
      'principal', '[]'::jsonb,
      'corrida', null
    );
  END IF;

  v_plano := public.fn_plano_principal_ativo(p_aluno_id);

  IF v_plano.id IS NOT NULL THEN
    IF v_plano.catalogo_id IS NOT NULL THEN
      SELECT * INTO v_cat FROM public.planos_catalogo WHERE id = v_plano.catalogo_id;
    END IF;

    -- 1. Upgrade: Start+ (antigo), Power (antigo/2027), Pro (antigo/2027) com data_fim futura
    IF (
         (v_plano.catalogo_id IS NOT NULL AND v_cat.familia IN ('power_2027', 'pro_2027'))
         OR (v_plano.catalogo_id IS NULL AND v_plano.tipo IN ('Start+', 'Power', 'Pro'))
       )
       AND v_plano.data_fim IS NOT NULL
       AND v_plano.data_fim > v_hoje THEN

      v_segmento := 'upgrade';

      IF v_plano.catalogo_id IS NOT NULL THEN
        v_nivel_atual := CASE v_cat.frequencia::text
          WHEN '1x' THEN 1
          WHEN '2x' THEN 2
          WHEN '3x' THEN 3
          WHEN 'livre' THEN 4
          ELSE NULL
        END;
      ELSE
        SELECT c.frequencia_semanal
          INTO v_freq_atual
          FROM public.contratos c
         WHERE c.plano_id = v_plano.id
           AND c.status = 'ativo'
         ORDER BY c.created_at DESC
         LIMIT 1;

        v_nivel_atual := CASE v_freq_atual
          WHEN 1 THEN 1
          WHEN 2 THEN 2
          WHEN 3 THEN 3
          WHEN 5 THEN 4
          ELSE NULL
        END;
      END IF;

      IF v_nivel_atual IS NOT NULL AND v_nivel_atual < 4 THEN
        FOR v_target IN (v_nivel_atual + 1)..4 LOOP
          v_degraus := v_target - v_nivel_atual;
          v_freq_label := CASE v_target
            WHEN 2 THEN '2x'
            WHEN 3 THEN '3x'
            WHEN 4 THEN 'livre'
          END;
          v_calc_promo := public.fn_promo10_ciclo(v_plano.data_inicio, v_plano.data_fim, v_hoje, v_degraus, 80.00);
          v_calc_cheio := public.fn_promo10_ciclo(v_plano.data_inicio, v_plano.data_fim, v_hoje, v_degraus, 100.00);

          v_principal := v_principal || jsonb_build_array(
            jsonb_build_object(
              'tipo', 'upgrade',
              'plano_atual', v_plano.tipo,
              'frequencia_atual', CASE v_nivel_atual WHEN 1 THEN '1x' WHEN 2 THEN '2x' WHEN 3 THEN '3x' END,
              'frequencia_destino', v_freq_label,
              'degraus', v_degraus,
              'data_inicio_ciclo', v_plano.data_inicio,
              'data_fim_plano', v_plano.data_fim,
              'valor_promocional', (v_calc_promo->>'total')::numeric,
              'valor_sem_desconto', (v_calc_cheio->>'total')::numeric,
              'economia', round((v_calc_cheio->>'total')::numeric - (v_calc_promo->>'total')::numeric, 2),
              'calculo_promocional', v_calc_promo,
              'calculo_sem_desconto', v_calc_cheio
            )
          );
        END LOOP;
      END IF;

    -- 2. Agregadoras (Wellhub / TotalPass)
    ELSIF v_plano.tipo IN ('Gympass/Wellhub', 'Total Pass') THEN
      v_agr := CASE WHEN v_plano.tipo = 'Gympass/Wellhub' THEN 'wellhub' ELSE 'totalpass' END;
      v_segmento := v_agr;

      SELECT valor INTO v_ref_start3x
        FROM public.planos_catalogo
       WHERE codigo = 'start_2027_3x_mensal'
       LIMIT 1;

      FOR v_item IN
        SELECT codigo, nome, nome_exibicao, valor, periodo_meses, frequencia
          FROM public.planos_catalogo
         WHERE agregadora_requerida = v_agr
           AND familia = 'semestral_2027'
         ORDER BY valor ASC
      LOOP
        v_eleg := public.fn_semestral_elegivel(p_aluno_id, v_item.codigo, v_hoje, false);
        IF COALESCE((v_eleg->>'elegivel')::boolean, false) THEN
          v_principal := v_principal || jsonb_build_array(
            jsonb_build_object(
              'tipo', 'semestral_agregadora',
              'codigo', v_item.codigo,
              'nome', COALESCE(v_item.nome_exibicao, v_item.nome),
              'agregadora', v_agr,
              'frequencia', v_item.frequencia::text,
              'valor_mensal', v_item.valor,
              'valor_promocional', round(v_item.valor * 6, 2),
              'valor_referencia_mes', v_ref_start3x,
              'valor_sem_desconto', CASE WHEN v_ref_start3x IS NOT NULL THEN round(v_ref_start3x * 6, 2) ELSE NULL END,
              'economia_mes', CASE WHEN v_ref_start3x IS NOT NULL THEN round(v_ref_start3x - v_item.valor, 2) ELSE NULL END,
              'economia_6_meses', CASE WHEN v_ref_start3x IS NOT NULL THEN round((v_ref_start3x - v_item.valor) * 6, 2) ELSE NULL END
            )
          );
        END IF;
      END LOOP;

    ELSIF v_plano.tipo ILIKE 'Corrida%' THEN
      v_segmento := 'so_corrida';
    ELSE
      v_segmento := 'sem_oferta';
    END IF;

  ELSE
    -- 3. Sem plano ativo: ex-aluno (tem historico em planos, inclusive agregadora)
    SELECT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = p_aluno_id)
      INTO v_tem_historico;

    IF v_tem_historico THEN
      v_segmento := 'ex_aluno';

      FOR v_item IN
        SELECT codigo, nome, nome_exibicao, familia, frequencia, modalidade_cobranca, valor, COALESCE(taxa_recorrencia, 0) AS taxa_recorrencia
          FROM public.planos_catalogo
         WHERE familia IN ('power_2027', 'pro_2027')
           AND modalidade_cobranca IN ('anual', 'recorrencia_mensal')
         ORDER BY
           CASE familia WHEN 'power_2027' THEN 1 ELSE 2 END,
           CASE frequencia::text WHEN '1x' THEN 1 WHEN '2x' THEN 2 WHEN '3x' THEN 3 WHEN 'livre' THEN 4 ELSE 5 END,
           CASE modalidade_cobranca WHEN 'anual' THEN 1 ELSE 2 END
      LOOP
        IF v_item.modalidade_cobranca = 'anual' THEN
          v_sem_desc := round(v_item.valor, 2);
          v_promo := round(v_item.valor - v_desc_ex_aluno, 2);
        ELSE
          v_sem_desc := round((v_item.valor + v_item.taxa_recorrencia) * 12, 2);
          v_promo := round(v_sem_desc - v_desc_ex_aluno, 2);
        END IF;

        v_principal := v_principal || jsonb_build_array(
          jsonb_build_object(
            'tipo', 'ex_aluno',
            'codigo', v_item.codigo,
            'nome', COALESCE(v_item.nome_exibicao, v_item.nome),
            'familia', v_item.familia,
            'frequencia', v_item.frequencia::text,
            'modalidade_cobranca', v_item.modalidade_cobranca,
            'valor_sem_desconto', v_sem_desc,
            'valor_promocional', v_promo,
            'parcela_12x', round(v_promo / 12.0, 2),
            'economia', v_desc_ex_aluno
          )
        );
      END LOOP;
    END IF;
  END IF;

  -- 4. Corrida 6+1 meses (soma para qualquer aluno sem Corrida ativa)
  v_tem_corrida := public.fn_tem_plano_corrida(p_aluno_id, v_hoje);
  IF NOT v_tem_corrida THEN
    IF v_plano.id IS NOT NULL THEN
      IF v_plano.catalogo_id IS NOT NULL THEN
        v_corrida_nome := CASE v_cat.familia
          WHEN 'pro_2027' THEN 'Corrida - Pro'
          WHEN 'power_2027' THEN 'Corrida - Power'
          WHEN 'start_2027' THEN 'Corrida - Start'
          ELSE 'Corrida - Sem Plano'
        END;
      ELSE
        v_corrida_nome := CASE
          WHEN v_plano.tipo IN ('Pro', 'VIP') THEN 'Corrida - Pro'
          WHEN v_plano.tipo = 'Power' THEN 'Corrida - Power'
          WHEN v_plano.tipo = 'Start+' THEN 'Corrida - Start+'
          WHEN v_plano.tipo = 'Start' THEN 'Corrida - Start'
          ELSE 'Corrida - Sem Plano'
        END;
      END IF;
    ELSE
      v_corrida_nome := 'Corrida - Sem Plano';
    END IF;

    SELECT valor
      INTO v_corrida_valor
      FROM public.planos_catalogo
     WHERE nome = v_corrida_nome
       AND periodo_meses = 6
     LIMIT 1;

    IF v_corrida_valor IS NOT NULL THEN
      v_corrida := jsonb_build_object(
        'tipo', 'corrida_6_mais_1',
        'nome_catalogo', v_corrida_nome,
        'meses_pagos', 6,
        'meses_total', 7,
        'valor_promocional', round(v_corrida_valor, 2),
        'valor_equivalente_mes', round(v_corrida_valor / 7.0, 2),
        'valor_sem_desconto', round(v_corrida_valor * 7.0 / 6.0, 2),
        'economia', round(v_corrida_valor / 6.0, 2)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'encerrada', false,
    'segmento', v_segmento,
    'principal', v_principal,
    'corrida', v_corrida
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_promo10_ofertas(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_ofertas(uuid, date) TO service_role;

-- 4. Tabelas de verificação e sessão (somente servidor / service_role)
CREATE TABLE public.promo10_verificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  email text NOT NULL,
  codigo_hash text NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  expira_em timestamptz NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  validado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo10_verificacoes_aluno ON public.promo10_verificacoes(aluno_id);

REVOKE ALL ON public.promo10_verificacoes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promo10_verificacoes TO service_role;
ALTER TABLE public.promo10_verificacoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.promo10_sessoes (
  token_hash text PRIMARY KEY,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL
);

CREATE INDEX idx_promo10_sessoes_aluno ON public.promo10_sessoes(aluno_id);

REVOKE ALL ON public.promo10_sessoes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promo10_sessoes TO service_role;
ALTER TABLE public.promo10_sessoes ENABLE ROW LEVEL SECURITY;

-- 5. Validação do código (máx. 5 tentativas) e criação da sessão (30 min)
CREATE OR REPLACE FUNCTION public.fn_promo10_codigo_validar(
  p_id uuid,
  p_hash text,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.promo10_verificacoes;
  v_tent integer;
BEGIN
  SELECT * INTO v_row
    FROM public.promo10_verificacoes
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND OR v_row.validado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'invalido');
  END IF;

  IF v_row.expira_em <= now() THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'expirado');
  END IF;

  IF v_row.tentativas >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'restantes', 0);
  END IF;

  IF v_row.codigo_hash <> p_hash THEN
    v_tent := v_row.tentativas + 1;
    UPDATE public.promo10_verificacoes
       SET tentativas = v_tent
     WHERE id = p_id;

    RETURN jsonb_build_object(
      'ok', false,
      'motivo', CASE WHEN v_tent >= 5 THEN 'bloqueado' ELSE 'errado' END,
      'restantes', GREATEST(0, 5 - v_tent)
    );
  END IF;

  UPDATE public.promo10_verificacoes
     SET validado_em = now()
   WHERE id = p_id;

  INSERT INTO public.promo10_sessoes (token_hash, aluno_id, expira_em)
  VALUES (p_token_hash, v_row.aluno_id, now() + interval '30 minutes');

  RETURN jsonb_build_object('ok', true, 'aluno_id', v_row.aluno_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_promo10_codigo_validar(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_codigo_validar(uuid, text, text) TO service_role;

-- 6. Registro de interesse (recalcula no servidor, regra de combinação e sem duplicidade)
CREATE OR REPLACE FUNCTION public.fn_promo10_registrar_interesse(
  p_token_hash text,
  p_tipo text,
  p_chave text,
  p_hoje date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessao public.promo10_sessoes;
  v_ofertas jsonb;
  v_segmento text;
  v_escolhida jsonb := null;
  v_elem jsonb;
  v_oferta text;
  v_valor_promo numeric(10,2);
  v_valor_sem numeric(10,2);
  v_existente public.promo10_interesses;
  v_salvo public.promo10_interesses;
  v_lista jsonb;
BEGIN
  SELECT * INTO v_sessao
    FROM public.promo10_sessoes
   WHERE token_hash = p_token_hash
     AND expira_em > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sessao_invalida');
  END IF;

  v_ofertas := public.fn_promo10_ofertas(v_sessao.aluno_id, p_hoje);
  IF COALESCE((v_ofertas->>'encerrada')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'encerrada');
  END IF;

  v_segmento := COALESCE(v_ofertas->>'segmento', 'sem_oferta');

  IF p_tipo = 'corrida' THEN
    IF v_ofertas->'corrida' IS NULL OR jsonb_typeof(v_ofertas->'corrida') = 'null' THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'oferta_invalida');
    END IF;
    v_escolhida := v_ofertas->'corrida';
    v_oferta := 'corrida_6_mais_1';
    v_valor_promo := (v_escolhida->>'valor_promocional')::numeric;
    v_valor_sem := (v_escolhida->>'valor_sem_desconto')::numeric;

    SELECT * INTO v_existente
      FROM public.promo10_interesses
     WHERE aluno_id = v_sessao.aluno_id
       AND oferta = 'corrida_6_mais_1'
       AND status IN ('novo', 'contatado')
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF FOUND THEN
      UPDATE public.promo10_interesses
         SET segmento = v_segmento,
             detalhes = v_escolhida,
             valor_promocional = v_valor_promo,
             valor_sem_desconto = v_valor_sem,
             atualizado_em = now()
       WHERE id = v_existente.id
       RETURNING * INTO v_salvo;
    ELSE
      INSERT INTO public.promo10_interesses (aluno_id, segmento, oferta, detalhes, valor_promocional, valor_sem_desconto)
      VALUES (v_sessao.aluno_id, v_segmento, v_oferta, v_escolhida, v_valor_promo, v_valor_sem)
      RETURNING * INTO v_salvo;
    END IF;

  ELSIF p_tipo = 'principal' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_ofertas->'principal', '[]'::jsonb))
    LOOP
      IF (v_elem->>'tipo' = 'upgrade' AND v_elem->>'frequencia_destino' = p_chave)
         OR (v_elem->>'tipo' IN ('semestral_agregadora', 'ex_aluno') AND v_elem->>'codigo' = p_chave) THEN
        v_escolhida := v_elem;
        EXIT;
      END IF;
    END LOOP;

    IF v_escolhida IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'oferta_invalida');
    END IF;

    v_oferta := CASE
      WHEN v_escolhida->>'tipo' = 'upgrade' THEN 'upgrade_' || (v_escolhida->>'frequencia_destino')
      ELSE v_escolhida->>'codigo'
    END;
    v_valor_promo := (v_escolhida->>'valor_promocional')::numeric;
    v_valor_sem := CASE
      WHEN v_escolhida->>'valor_sem_desconto' IS NOT NULL THEN (v_escolhida->>'valor_sem_desconto')::numeric
      ELSE NULL
    END;

    -- 1. Mesma oferta já registrada (novo/contatado): atualiza
    SELECT * INTO v_existente
      FROM public.promo10_interesses
     WHERE aluno_id = v_sessao.aluno_id
       AND oferta = v_oferta
       AND status IN ('novo', 'contatado')
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF FOUND THEN
      UPDATE public.promo10_interesses
         SET segmento = v_segmento,
             detalhes = v_escolhida,
             valor_promocional = v_valor_promo,
             valor_sem_desconto = v_valor_sem,
             atualizado_em = now()
       WHERE id = v_existente.id
       RETURNING * INTO v_salvo;
    ELSE
      -- 2. Outra principal já contatada: não substitui
      SELECT * INTO v_existente
        FROM public.promo10_interesses
       WHERE aluno_id = v_sessao.aluno_id
         AND oferta <> 'corrida_6_mais_1'
         AND status = 'contatado'
       ORDER BY created_at DESC
       LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'ok', false,
          'motivo', 'ja_contatado',
          'codigo_pedido', v_existente.codigo_pedido
        );
      END IF;

      -- 3. Outra principal ainda com status novo: substitui
      SELECT * INTO v_existente
        FROM public.promo10_interesses
       WHERE aluno_id = v_sessao.aluno_id
         AND oferta <> 'corrida_6_mais_1'
         AND status = 'novo'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE;

      IF FOUND THEN
        UPDATE public.promo10_interesses
           SET segmento = v_segmento,
               oferta = v_oferta,
               detalhes = v_escolhida,
               valor_promocional = v_valor_promo,
               valor_sem_desconto = v_valor_sem,
               atualizado_em = now()
         WHERE id = v_existente.id
         RETURNING * INTO v_salvo;
      ELSE
        INSERT INTO public.promo10_interesses (aluno_id, segmento, oferta, detalhes, valor_promocional, valor_sem_desconto)
        VALUES (v_sessao.aluno_id, v_segmento, v_oferta, v_escolhida, v_valor_promo, v_valor_sem)
        RETURNING * INTO v_salvo;
      END IF;
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'motivo', 'oferta_invalida');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'codigo_pedido', codigo_pedido,
        'segmento', segmento,
        'oferta', oferta,
        'valor_promocional', valor_promocional,
        'valor_sem_desconto', valor_sem_desconto,
        'detalhes', detalhes,
        'status', status
      ) ORDER BY CASE WHEN oferta = 'corrida_6_mais_1' THEN 2 ELSE 1 END, created_at ASC
    ),
    '[]'::jsonb
  )
    INTO v_lista
    FROM public.promo10_interesses
   WHERE aluno_id = v_sessao.aluno_id
     AND status IN ('novo', 'contatado');

  RETURN jsonb_build_object(
    'ok', true,
    'codigo_pedido', v_salvo.codigo_pedido,
    'oferta', v_salvo.oferta,
    'segmento', v_salvo.segmento,
    'valor_promocional', v_salvo.valor_promocional,
    'valor_sem_desconto', v_salvo.valor_sem_desconto,
    'detalhes', v_salvo.detalhes,
    'interesses', v_lista
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_promo10_registrar_interesse(text, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_registrar_interesse(text, text, text, date) TO service_role;