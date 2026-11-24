CREATE OR REPLACE FUNCTION public.fn_promo10_registrar_interesse(
  p_token_hash text,
  p_tipo text,
  p_chave text,
  p_hoje date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_acao text := 'criado';
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
      v_acao := 'atualizado';
      UPDATE public.promo10_interesses
         SET segmento = v_segmento,
             detalhes = v_escolhida,
             valor_promocional = v_valor_promo,
             valor_sem_desconto = v_valor_sem,
             atualizado_em = now()
       WHERE id = v_existente.id
       RETURNING * INTO v_salvo;
    ELSE
      v_acao := 'criado';
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
      v_acao := 'atualizado';
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
        v_acao := 'substituido';
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
        v_acao := 'criado';
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
    'acao', v_acao,
    'codigo_pedido', v_salvo.codigo_pedido,
    'oferta', v_salvo.oferta,
    'segmento', v_salvo.segmento,
    'valor_promocional', v_salvo.valor_promocional,
    'valor_sem_desconto', v_salvo.valor_sem_desconto,
    'detalhes', v_salvo.detalhes,
    'interesses', v_lista
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_promo10_admin_recalcular(
  p_interesse_id uuid,
  p_hoje date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_int public.promo10_interesses;
  v_ofertas jsonb;
  v_elem jsonb;
  v_freq_dest text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_int
    FROM public.promo10_interesses
   WHERE id = p_interesse_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('disponivel', false, 'motivo', 'nao_encontrado');
  END IF;

  IF COALESCE(v_int.detalhes->>'tipo', '') <> 'upgrade' THEN
    RETURN jsonb_build_object('disponivel', false, 'motivo', 'nao_e_upgrade');
  END IF;

  v_freq_dest := v_int.detalhes->>'frequencia_destino';
  v_ofertas := public.fn_promo10_ofertas(v_int.aluno_id, v_hoje);

  IF COALESCE((v_ofertas->>'encerrada')::boolean, false) THEN
    RETURN jsonb_build_object('disponivel', false, 'motivo', 'encerrada', 'data_referencia', v_hoje);
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_ofertas->'principal', '[]'::jsonb))
  LOOP
    IF v_elem->>'tipo' = 'upgrade' AND v_elem->>'frequencia_destino' = v_freq_dest THEN
      RETURN jsonb_build_object(
        'disponivel', true,
        'data_referencia', v_hoje,
        'oferta', v_elem
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('disponivel', false, 'motivo', 'indisponivel_hoje', 'data_referencia', v_hoje);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_promo10_admin_recalcular(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_promo10_admin_recalcular(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_promo10_admin_recalcular(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_promo10_admin_recalcular(uuid, date) TO service_role;