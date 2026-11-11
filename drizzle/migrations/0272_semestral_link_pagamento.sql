ALTER TABLE public.links_pagamento ADD COLUMN IF NOT EXISTS humano_em timestamptz;
COMMENT ON COLUMN public.links_pagamento.humano_em IS 'Última verificação Turnstile aprovada na página do link (Plano Semestral).';

-- Núcleo da escolha do cartão (sem checagem de papel); o wrapper da equipe e o link público usam o mesmo.
CREATE OR REPLACE FUNCTION public.fn_semestral_definir_cartao_core(p_venda uuid, p_cartao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.vendas; k public.contratos;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:'||p_venda::text,0));
  SELECT * INTO v FROM public.vendas WHERE id = p_venda FOR UPDATE;
  SELECT * INTO k FROM public.contratos WHERE plano_id = v.plano_id AND plano_tipo = 'semestral_2027' FOR UPDATE;
  IF v.id IS NULL OR k.id IS NULL THEN RAISE EXCEPTION 'Venda do Plano Semestral não encontrada'; END IF;
  IF v.status_pagamento IN ('pago','cancelado','estornado') OR k.status <> 'ativo'
     OR EXISTS (SELECT 1 FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1 AND status = 'pago') THEN
    RAISE EXCEPTION 'A 1ª mensalidade já foi paga ou a venda não está mais aberta';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_rede WHERE venda_id = v.id AND status IN ('pending','approved')) THEN
    RAISE EXCEPTION 'Há um pagamento em processamento para esta venda; não troque o cartão agora';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cartoes_salvos cs JOIN public.rede_tokenizacoes t ON t.cartao_salvo_id = cs.id
                  WHERE cs.id = p_cartao AND cs.aluno_id = v.aluno_id AND cs.ativo
                    AND t.aluno_id = v.aluno_id AND t.proposta_id IS NULL AND t.status = 'active') THEN
    RAISE EXCEPTION 'Cartão não pertence ao aluno ou ainda não foi confirmado pela Rede';
  END IF;
  UPDATE public.contratos SET cartao_token_id = p_cartao WHERE id = k.id;
  UPDATE public.planos SET cartao_token_id = p_cartao WHERE id = v.plano_id;
  RETURN jsonb_build_object('ok', true, 'contrato_id', k.id);
END $$;
REVOKE ALL ON FUNCTION public.fn_semestral_definir_cartao_core(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_definir_cartao_core(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_semestral_definir_cartao(p_venda uuid, p_cartao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN public.fn_semestral_definir_cartao_core(p_venda, p_cartao);
END $$;

-- Validade do link: 72 h, nunca depois do dia em que a rotina expira a venda (8º dia, 00:00 de Brasília).
CREATE OR REPLACE FUNCTION public.fn_semestral_link_validade(p_agora timestamptz, p_venda_criada timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT LEAST(p_agora + interval '72 hours',
               (((p_venda_criada AT TIME ZONE 'America/Sao_Paulo')::date + 8)::timestamp) AT TIME ZONE 'America/Sao_Paulo');
$$;

-- Gera (ou reaproveita) o link de pagamento da 1ª mensalidade do Semestral. Só admin/coordenador.
CREATE OR REPLACE FUNCTION public.fn_semestral_link_criar(p_venda uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.vendas; c public.planos_catalogo; k public.contratos; a public.alunos;
        l public.links_pagamento; v_exp timestamptz; v_tel text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('semestral_link:'||p_venda::text,0));
  SELECT * INTO v FROM public.vendas WHERE id = p_venda;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = v.catalogo_id;
  IF v.id IS NULL OR c.familia IS DISTINCT FROM 'semestral_2027' THEN RAISE EXCEPTION 'Venda do Plano Semestral não encontrada'; END IF;
  SELECT * INTO k FROM public.contratos WHERE plano_id = v.plano_id AND plano_tipo = 'semestral_2027';
  IF v.status_pagamento IN ('pago','cancelado','estornado','falha') OR k.id IS NULL OR k.status <> 'ativo'
     OR EXISTS (SELECT 1 FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1 AND status = 'pago') THEN
    RAISE EXCEPTION 'A venda não está mais aguardando a 1ª mensalidade';
  END IF;
  v_exp := public.fn_semestral_link_validade(now(), v.created_at);
  IF v_exp <= now() THEN RAISE EXCEPTION 'A venda já passou do prazo de 7 dias'; END IF;
  SELECT * INTO l FROM public.links_pagamento
   WHERE venda_id = v.id AND usado_em IS NULL AND expira_em > now()
   ORDER BY criado_em DESC LIMIT 1;
  IF l.id IS NULL THEN
    UPDATE public.links_pagamento SET expira_em = now() WHERE venda_id = v.id AND usado_em IS NULL AND expira_em > now();
    INSERT INTO public.links_pagamento (venda_id, token, criado_por, expira_em, parcelas_max, parcelas_fixas)
    VALUES (v.id, encode(extensions.gen_random_bytes(32), 'hex'), auth.uid(), v_exp, 1, true)
    RETURNING * INTO l;
  END IF;
  SELECT * INTO a FROM public.alunos WHERE id = v.aluno_id;
  v_tel := regexp_replace(COALESCE(a.telefone, ''), '\D', '', 'g');
  RETURN jsonb_build_object(
    'token', l.token, 'expira_em', l.expira_em,
    'primeiro_nome', split_part(btrim(COALESCE(a.nome, '')), ' ', 1),
    'telefone', v_tel,
    'plano', COALESCE(c.nome_exibicao, c.nome),
    'valor', v.valor_final);
END $$;
REVOKE ALL ON FUNCTION public.fn_semestral_link_criar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_semestral_link_criar(uuid) TO authenticated, service_role;

-- Desistência/expiração (ou qualquer encerramento) da venda Semestral invalida o link na hora.
CREATE OR REPLACE FUNCTION public.fn_semestral_link_invalidar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status_pagamento IN ('cancelado','estornado','falha')
     AND NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento
     AND EXISTS (SELECT 1 FROM public.planos_catalogo WHERE id = NEW.catalogo_id AND familia = 'semestral_2027') THEN
    UPDATE public.links_pagamento SET expira_em = now()
     WHERE venda_id = NEW.id AND usado_em IS NULL AND expira_em > now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_semestral_link_invalidar ON public.vendas;
CREATE TRIGGER trg_semestral_link_invalidar AFTER UPDATE OF status_pagamento ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.fn_semestral_link_invalidar();