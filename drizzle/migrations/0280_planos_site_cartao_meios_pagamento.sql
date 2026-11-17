ALTER TABLE public.cartoes_salvos DROP CONSTRAINT cartoes_salvos_origem_check;
ALTER TABLE public.cartoes_salvos ADD CONSTRAINT cartoes_salvos_origem_check
  CHECK (origem = ANY (ARRAY['portal_aluno','link_cadastro','recepcao','planos_site']));

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_salvar(p_proposta_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE p record; rt record; v_id uuid; v_mes int; v_ano int; v_nome text;
BEGIN
  SELECT id, aluno_ativado_id, ativada_em, coalesce(teste_admin, false) AS teste INTO p
    FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  IF NOT FOUND OR p.ativada_em IS NULL OR p.aluno_ativado_id IS NULL OR p.teste THEN RETURN NULL; END IF;

  SELECT r.* INTO rt FROM public.checkout_2027_tentativas t
    JOIN public.rede_tokenizacoes r ON r.id = t.tokenizacao_id
   WHERE t.proposta_id = p_proposta_id AND t.status = 'aprovado' AND NOT coalesce(t.simulado, false)
     AND r.status = 'active' AND r.token_code IS NOT NULL AND r.token_code NOT LIKE 'SIMULACAO-%'
     AND r.last4 IS NOT NULL AND r.token_expiration ~ '^\d{2}/\d{4}$'
   ORDER BY t.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_id FROM public.cartoes_salvos
   WHERE aluno_id = p.aluno_ativado_id AND token_rede = rt.token_code LIMIT 1;
  IF v_id IS NULL THEN
    v_mes := split_part(rt.token_expiration, '/', 1)::int;
    v_ano := split_part(rt.token_expiration, '/', 2)::int;
    SELECT coalesce(nullif(trim(rt.cardholder_name), ''), a.nome) INTO v_nome FROM public.alunos a WHERE a.id = p.aluno_ativado_id;
    INSERT INTO public.cartoes_salvos (aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo, is_default, origem)
    VALUES (p.aluno_ativado_id, rt.token_code, coalesce(rt.brand_name, 'Cartão'), rt.last4, coalesce(v_nome, 'Titular'), v_mes, v_ano, true,
            NOT EXISTS (SELECT 1 FROM public.cartoes_salvos c WHERE c.aluno_id = p.aluno_ativado_id AND c.ativo AND c.is_default),
            'planos_site')
    RETURNING id INTO v_id;
  END IF;
  UPDATE public.rede_tokenizacoes SET cartao_salvo_id = v_id WHERE id = rt.id AND cartao_salvo_id IS NULL;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_salvar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_salvar(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_salvar_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM public.fn_checkout_2027_cartao_salvar(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
    VALUES ('planos-ativacao', 'cartao_salvar_falhou', left(SQLERRM, 300), jsonb_build_object('proposta_id', NEW.id));
  END;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_salvar_trg() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_checkout_2027_cartao_salvar AFTER UPDATE OF ativada_em ON public.propostas_planos_2027
FOR EACH ROW WHEN (OLD.ativada_em IS NULL AND NEW.ativada_em IS NOT NULL)
EXECUTE FUNCTION public.fn_checkout_2027_cartao_salvar_trg();