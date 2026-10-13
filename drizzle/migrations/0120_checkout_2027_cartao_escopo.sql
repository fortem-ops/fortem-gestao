-- Trava antes da F5: cartão real só em proposta de teste, salvo planos_cartao_real_escopo = "todos".
-- Escopo ausente ou qualquer valor diferente de "todos" conta como "teste".
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_real(p_proposta_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_modo text; v_flag text; v_escopo text; v_rev jsonb; v_teste boolean;
BEGIN
  IF public.fn_checkout_2027_cartao_simulado(p_proposta_id) THEN RETURN false; END IF;
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT valor #>> '{}' INTO v_flag FROM public.sistema_config WHERE chave = 'planos_cartao_real_ativo';
  SELECT valor #>> '{}' INTO v_escopo FROM public.sistema_config WHERE chave = 'planos_cartao_real_escopo';
  SELECT revisao INTO v_rev FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  IF coalesce(v_flag,'false') <> 'true' THEN RETURN false; END IF;
  IF v_teste THEN
    -- Teste: sempre exige real_baixo_valor (teto e reversão em fn_checkout_2027_pagamento_iniciar), qualquer escopo.
    IF coalesce(v_modo,'simulacao') <> 'real_baixo_valor' THEN RETURN false; END IF;
  ELSIF coalesce(v_escopo,'teste') <> 'todos' THEN
    RETURN false;
  END IF;
  RETURN public.fn_checkout_2027_cartao_elegivel(v_rev);
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_real(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_real(uuid) TO service_role;