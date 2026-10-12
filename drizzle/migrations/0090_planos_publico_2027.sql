-- Fase 4: página pública /planos 2027 (leitura segura do catálogo + propostas do site)

CREATE TABLE public.propostas_planos_2027 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text NOT NULL,
  cpf_ultimos3 text,
  plano_codigo text NOT NULL,
  familia text NOT NULL,
  frequencia text NOT NULL,
  forma_plano text NOT NULL,
  parcelas_plano integer NOT NULL DEFAULT 1,
  servicos_codigos text[] NOT NULL DEFAULT '{}',
  forma_servicos text,
  parcelas_servicos integer,
  corrida boolean NOT NULL DEFAULT false,
  corrida_valor_mensal numeric,
  valor_total_centavos bigint NOT NULL,
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT 'site_planos',
  status text NOT NULL DEFAULT 'nova',
  previa boolean NOT NULL DEFAULT false,
  aluno_id uuid,
  lead_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.propostas_planos_2027 TO authenticated;
GRANT ALL ON public.propostas_planos_2027 TO service_role;
ALTER TABLE public.propostas_planos_2027 ENABLE ROW LEVEL SECURITY;

CREATE POLICY propostas_2027_staff_select ON public.propostas_planos_2027
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY propostas_2027_staff_update ON public.propostas_planos_2027
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY propostas_2027_admin_delete ON public.propostas_planos_2027
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX idx_propostas_2027_created ON public.propostas_planos_2027 (created_at DESC);

CREATE TRIGGER update_propostas_2027_updated_at BEFORE UPDATE ON public.propostas_planos_2027
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rate_limit_propostas_planos (
  chave text NOT NULL,
  janela timestamptz NOT NULL,
  contagem integer NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, janela)
);
GRANT ALL ON public.rate_limit_propostas_planos TO service_role;
ALTER TABLE public.rate_limit_propostas_planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_limit_propostas_admin_select ON public.rate_limit_propostas_planos
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Itens visíveis: público só vendáveis hoje; prévia só para admin (inclui desligados).
CREATE OR REPLACE FUNCTION public.fn_planos_publico_2027(p_previa boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_admin boolean := auth.uid() IS NOT NULL AND public.is_admin(auth.uid());
  v_planos jsonb;
  v_servicos jsonb;
  v_corrida jsonb;
BEGIN
  IF p_previa AND NOT v_admin THEN
    RETURN jsonb_build_object('previa', false, 'disponivel', false,
      'planos', '[]'::jsonb, 'servicos', '[]'::jsonb, 'corrida', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'codigo', c.codigo, 'familia', c.familia, 'nome', coalesce(c.nome_exibicao, c.nome),
      'frequencia', c.frequencia::text, 'modalidade_cobranca', c.modalidade_cobranca,
      'valor', c.valor, 'taxa_recorrencia', coalesce(c.taxa_recorrencia, 0),
      'quantidade_creditos', c.quantidade_creditos, 'ilimitado', c.ilimitado,
      'fidelidade_meses', c.fidelidade_meses, 'licenca_dias', c.licenca_dias,
      'avaliacoes_funcionais', coalesce(array_length(c.avaliacoes_funcionais_meses, 1), 0),
      'permite_fixar_horario', coalesce(c.permite_fixar_horario, false),
      'bota_compressao_mes', coalesce(c.bota_compressao_mes, 0),
      'nivel_clube', c.nivel_clube, 'reposicao_saldo_pct', coalesce(c.reposicao_saldo_pct, 0)
    ) ORDER BY c.familia, c.frequencia, c.modalidade_cobranca), '[]'::jsonb)
  INTO v_planos
  FROM public.planos_catalogo c
  WHERE c.versao IS NOT NULL
    AND c.familia IN ('start_2027', 'power_2027', 'pro_2027')
    AND (p_previa OR (coalesce(c.ativo, false)
         AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= v_hoje)
         AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= v_hoje)));

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'codigo', s.codigo, 'nome', s.nome, 'atividade', s.atividade,
      'quantidade_sessoes', s.quantidade_sessoes, 'valor', s.valor, 'composicao', s.composicao
    ) ORDER BY s.atividade, s.valor), '[]'::jsonb)
  INTO v_servicos
  FROM public.servicos_catalogo s
  WHERE s.versao IS NOT NULL
    AND s.codigo IN ('nutri_4_comp_2_2027', 'nutri_8_2027', 'reab_4_2027', 'reab_8_2027')
    AND (p_previa OR (coalesce(s.ativo, false)
         AND (s.vendavel_desde IS NULL OR s.vendavel_desde <= v_hoje)
         AND (s.vendavel_ate IS NULL OR s.vendavel_ate >= v_hoje)));

  -- Grupo de corrida: itens legados ativos de 1 mês, apenas para exibição do valor.
  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', p.nome, 'valor', p.valor) ORDER BY p.nome), '[]'::jsonb)
  INTO v_corrida
  FROM public.planos_catalogo p
  WHERE p.atividade = 'corrida' AND coalesce(p.ativo, false) AND p.versao IS NULL
    AND p.periodo_meses = 1 AND p.nome IN ('Corrida - Start', 'Corrida - Power', 'Corrida - Pro');

  RETURN jsonb_build_object(
    'previa', p_previa,
    'disponivel', jsonb_array_length(v_planos) > 0,
    'planos', v_planos, 'servicos', v_servicos,
    'corrida', CASE WHEN jsonb_array_length(v_planos) > 0 THEN v_corrida ELSE '[]'::jsonb END);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_planos_publico_2027(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_planos_publico_2027(boolean) TO anon, authenticated, service_role;

-- Proposta do site: recalcula o valor no servidor; nunca cria venda/cobrança.
CREATE OR REPLACE FUNCTION public.fn_proposta_plano_2027_criar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_previa boolean := coalesce((p->>'previa')::boolean, false);
  v_nome text := btrim(coalesce(p->>'nome', ''));
  v_wpp text := regexp_replace(coalesce(p->>'whatsapp', ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p->>'email', '')));
  v_cpf text := regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g');
  v_codigo text := p->>'plano_codigo';
  v_forma text := p->>'forma_plano';
  v_parc int := coalesce((p->>'parcelas_plano')::int, 1);
  v_serv text[] := coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'servicos', '[]'::jsonb))), '{}');
  v_forma_s text := p->>'forma_servicos';
  v_parc_s int := coalesce((p->>'parcelas_servicos')::int, 1);
  v_corrida boolean := coalesce((p->>'corrida')::boolean, false);
  v_item record;
  v_serv_c bigint := 0;
  v_serv_n int := 0;
  v_plano_c bigint;
  v_total_c bigint;
  v_corrida_valor numeric;
  v_ip text;
  v_janela timestamptz := date_trunc('hour', now());
  v_cont int;
  v_id uuid;
  v_aluno uuid;
  v_novo boolean := false;
  v_lead_erro text;
  v_criador uuid;
  v_notif uuid;
BEGIN
  IF v_previa AND NOT (auth.uid() IS NOT NULL AND public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Prévia disponível só para administradores';
  END IF;
  IF length(v_nome) < 3 OR length(v_nome) > 120 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_wpp) NOT IN (10, 11) THEN RAISE EXCEPTION 'Informe um WhatsApp válido com DDD'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN RAISE EXCEPTION 'Informe um e-mail válido'; END IF;
  IF v_cpf <> '' AND length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF deve ter 11 dígitos'; END IF;

  -- Limite: 5 propostas por hora por WhatsApp e 20 por IP.
  v_ip := coalesce(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
  INSERT INTO public.rate_limit_propostas_planos(chave, janela, contagem) VALUES ('w:' || v_wpp, v_janela, 1)
    ON CONFLICT (chave, janela) DO UPDATE SET contagem = rate_limit_propostas_planos.contagem + 1
    RETURNING contagem INTO v_cont;
  IF v_cont > 5 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF v_ip <> '' THEN
    INSERT INTO public.rate_limit_propostas_planos(chave, janela, contagem) VALUES ('i:' || v_ip, v_janela, 1)
      ON CONFLICT (chave, janela) DO UPDATE SET contagem = rate_limit_propostas_planos.contagem + 1
      RETURNING contagem INTO v_cont;
    IF v_cont > 20 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  END IF;

  SELECT * INTO v_item FROM public.planos_catalogo c
  WHERE c.codigo = v_codigo AND c.versao IS NOT NULL AND c.familia IN ('start_2027', 'power_2027', 'pro_2027')
    AND (v_previa OR (coalesce(c.ativo, false)
         AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= v_hoje)
         AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= v_hoje)));
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível. Revise sua escolha'; END IF;

  SELECT coalesce(sum(round(s.valor * 100)), 0)::bigint, count(*) INTO v_serv_c, v_serv_n
  FROM public.servicos_catalogo s
  WHERE s.codigo = ANY(v_serv) AND s.versao IS NOT NULL
    AND s.codigo IN ('nutri_4_comp_2_2027', 'nutri_8_2027', 'reab_4_2027', 'reab_8_2027')
    AND (v_previa OR (coalesce(s.ativo, false)
         AND (s.vendavel_desde IS NULL OR s.vendavel_desde <= v_hoje)
         AND (s.vendavel_ate IS NULL OR s.vendavel_ate >= v_hoje)));
  IF v_serv_n <> coalesce(array_length(v_serv, 1), 0) THEN RAISE EXCEPTION 'Acompanhamento indisponível. Revise sua escolha'; END IF;

  IF v_item.modalidade_cobranca = 'recorrencia_mensal' THEN
    IF v_forma <> 'recorrencia' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
    v_parc := CASE WHEN v_item.familia = 'start_2027' THEN 1 ELSE 12 END;
    v_plano_c := (round(v_item.valor * 100) + CASE WHEN v_item.familia = 'start_2027' THEN 0
                  ELSE round(coalesce(v_item.taxa_recorrencia, 0) * 100) END)::bigint * v_parc;
    IF v_serv_n > 0 THEN
      IF v_forma_s NOT IN ('cartao_parcelado', 'pix_vista') THEN RAISE EXCEPTION 'Forma dos serviços inválida'; END IF;
      IF v_forma_s = 'pix_vista' THEN v_parc_s := 1; END IF;
      IF v_parc_s < 1 OR v_parc_s > 6 THEN RAISE EXCEPTION 'Serviços em até 6x'; END IF;
    ELSE v_forma_s := NULL; v_parc_s := NULL; END IF;
  ELSE
    IF v_forma NOT IN ('cartao_parcelado', 'pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
    IF v_forma = 'pix_vista' THEN v_parc := 1; END IF;
    IF v_parc < 1 OR v_parc > 12 THEN RAISE EXCEPTION 'Plano em até 12x'; END IF;
    v_plano_c := round(v_item.valor * 100)::bigint;
    v_forma_s := NULL; v_parc_s := NULL;
  END IF;
  v_total_c := v_plano_c + v_serv_c;

  IF v_corrida THEN
    SELECT p2.valor INTO v_corrida_valor FROM public.planos_catalogo p2
    WHERE p2.atividade = 'corrida' AND coalesce(p2.ativo, false) AND p2.versao IS NULL AND p2.periodo_meses = 1
      AND p2.nome = 'Corrida - ' || CASE v_item.familia WHEN 'start_2027' THEN 'Start' WHEN 'power_2027' THEN 'Power' ELSE 'Pro' END
    LIMIT 1;
  END IF;

  INSERT INTO public.propostas_planos_2027(nome, whatsapp, email, cpf_ultimos3, plano_codigo, familia, frequencia,
    forma_plano, parcelas_plano, servicos_codigos, forma_servicos, parcelas_servicos, corrida, corrida_valor_mensal,
    valor_total_centavos, configuracao, previa)
  VALUES (v_nome, v_wpp, v_email, CASE WHEN v_cpf <> '' THEN right(v_cpf, 3) END, v_item.codigo, v_item.familia,
    v_item.frequencia::text, v_forma, v_parc, v_serv, v_forma_s, v_parc_s, v_corrida, v_corrida_valor, v_total_c,
    jsonb_build_object('plano_centavos', v_plano_c, 'servicos_centavos', v_serv_c, 'nome_plano',
      coalesce(v_item.nome_exibicao, v_item.nome), 'modalidade', v_item.modalidade_cobranca), v_previa)
  RETURNING id INTO v_id;

  IF NOT v_previa THEN
    BEGIN
      SELECT a.id INTO v_aluno FROM public.alunos a
      WHERE regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') = v_wpp
         OR (a.email IS NOT NULL AND lower(a.email) = v_email)
      ORDER BY a.created_at LIMIT 1;
      IF v_aluno IS NULL THEN
        INSERT INTO public.alunos(nome, telefone, email, status) VALUES (v_nome, v_wpp, v_email, 'lead')
        RETURNING id INTO v_aluno;
        v_novo := true;
        IF v_cpf <> '' THEN PERFORM public.fn_service_set_cpf(v_aluno, v_cpf); END IF;
        INSERT INTO public.pipeline_metadata(aluno_id, origem_lead) VALUES (v_aluno, 'Site /planos')
          ON CONFLICT (aluno_id) DO NOTHING;
        PERFORM public.fn_move_pipeline(v_aluno, 'Novo lead', 'manual'::pipeline_movement_source, 'Proposta do site /planos', NULL);
      END IF;
      INSERT INTO public.pipeline_metadata(aluno_id) VALUES (v_aluno) ON CONFLICT (aluno_id) DO NOTHING;
      UPDATE public.pipeline_metadata SET plano_interesse = coalesce(v_item.nome_exibicao, v_item.nome) || ' ' || v_item.frequencia::text,
        valor_estimado_plano = v_total_c / 100.0,
        notas = trim(both E'\n' from coalesce(notas, '') || E'\nProposta do site /planos em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      WHERE aluno_id = v_aluno;
      UPDATE public.propostas_planos_2027 SET aluno_id = v_aluno WHERE id = v_id;
    EXCEPTION WHEN OTHERS THEN
      v_lead_erro := SQLERRM;
      UPDATE public.propostas_planos_2027 SET lead_erro = v_lead_erro WHERE id = v_id;
    END;

    BEGIN
      SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
      IF v_criador IS NOT NULL THEN
        INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por, aluno_id)
        VALUES ('Nova proposta do site: ' || v_nome,
          coalesce(v_item.nome_exibicao, v_item.nome) || ' ' || v_item.frequencia::text || ' · total R$ ' ||
          to_char(v_total_c / 100.0, 'FM999G999D00') || ' · WhatsApp ' || v_wpp || '. Veja em Leads > Propostas do site.',
          'comercial', 'alta', 'simples', v_criador, v_aluno)
        RETURNING id INTO v_notif;
        INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
        SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.propostas_planos_2027 SET lead_erro = coalesce(lead_erro || ' | ', '') || 'notificação: ' || SQLERRM WHERE id = v_id;
    END;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'valor_total_centavos', v_total_c, 'previa', v_previa);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_proposta_plano_2027_criar(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_proposta_plano_2027_criar(jsonb) TO anon, authenticated, service_role;
