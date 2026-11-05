-- Programa de Indicação, etapa 2: regra final de conversão, ações da equipe, portal e gestão.

-- Parte 0.1: converte qualquer venda paga de plano, exceto agregador (Wellhub/Gympass/TotalPass).
CREATE OR REPLACE FUNCTION public.fn_venda_plano_fortem(p_venda_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo text; _nome text; _fam text;
BEGIN
  SELECT v.tipo::text, lower(coalesce(pc.nome, v.nome_snapshot, '')), lower(coalesce(pc.familia, ''))
    INTO _tipo, _nome, _fam
  FROM public.vendas v LEFT JOIN public.planos_catalogo pc ON pc.id = v.catalogo_id
  WHERE v.id = p_venda_id;
  IF NOT FOUND OR _tipo <> 'plano' THEN RETURN false; END IF;
  IF _nome ~ '(wellhub|gympass|total\s*pass)' OR _fam ~ '(wellhub|gympass|total\s*pass|agregador)' THEN RETURN false; END IF;
  RETURN true;
END $$;

-- Gatilho permite correção de indicador e carga antiga só quando a RPC da equipe liga a flag da transação.
CREATE OR REPLACE FUNCTION public.trg_clube_indicacao_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _carga boolean := coalesce(current_setting('fortem.indicacao_carga', true), '') = '1';
        _corrigir boolean := coalesce(current_setting('fortem.indicacao_corrigir', true), '') = '1';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.indicado_id IS NULL THEN RAISE EXCEPTION 'indicado_obrigatorio' USING ERRCODE = 'P0001'; END IF;
    IF NEW.padrinho_id = NEW.indicado_id THEN RAISE EXCEPTION 'auto_indicacao' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.alunos WHERE id = NEW.padrinho_id AND coalesce(is_equipe, false)) THEN
      RAISE EXCEPTION 'indicador_equipe' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.alunos WHERE id = NEW.indicado_id AND coalesce(is_equipe, false)) THEN
      RAISE EXCEPTION 'indicado_equipe' USING ERRCODE = 'P0001'; END IF;
    IF NOT _carga AND public.fn_indicacao_aluno_ativo(NEW.indicado_id) THEN
      RAISE EXCEPTION 'indicado_ja_ativo' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.clube_indicacoes WHERE indicado_id = NEW.indicado_id) THEN
      RAISE EXCEPTION 'indicado_ja_tem_indicador' USING ERRCODE = 'P0001'; END IF;
    NEW.status := 'pendente';
    NEW.venda_id := NULL; NEW.convertido_em := NULL;
    NEW.pontos_pagos := 0; NEW.pontos_indicado := 0;
  ELSE
    IF NEW.indicado_id IS DISTINCT FROM OLD.indicado_id
       OR (NEW.padrinho_id IS DISTINCT FROM OLD.padrinho_id AND NOT (_corrigir AND OLD.status = 'pendente')) THEN
      RAISE EXCEPTION 'indicacao_imutavel' USING ERRCODE = 'P0001'; END IF;
    IF NEW.padrinho_id IS DISTINCT FROM OLD.padrinho_id THEN
      IF NEW.padrinho_id = NEW.indicado_id THEN RAISE EXCEPTION 'auto_indicacao' USING ERRCODE = 'P0001'; END IF;
      IF EXISTS (SELECT 1 FROM public.alunos WHERE id = NEW.padrinho_id AND coalesce(is_equipe, false)) THEN
        RAISE EXCEPTION 'indicador_equipe' USING ERRCODE = 'P0001'; END IF;
    END IF;
  END IF;
  NEW.expira_em := NEW.criada_em + interval '90 days';
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Busca do indicador por nome, código ou telefone (só dígitos, 8+).
CREATE OR REPLACE FUNCTION public.fn_indicacao_buscar_indicador(p_termo text)
RETURNS TABLE (aluno_id uuid, nome text, ativo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _dig text := regexp_replace(coalesce(p_termo, ''), '\D', '', 'g');
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_termo, ''))) < 3 THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.id, a.nome::text, public.fn_indicacao_aluno_ativo(a.id)
  FROM public.alunos a
  LEFT JOIN public.clube_codigos_indicacao c ON c.aluno_id = a.id
  WHERE NOT coalesce(a.is_equipe, false)
    AND a.status NOT IN ('lead','prospect')
    AND (unaccent(a.nome) ILIKE '%' || unaccent(trim(p_termo)) || '%'
         OR c.codigo = upper(trim(p_termo))
         OR (length(_dig) >= 8 AND regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') LIKE '%' || _dig || '%'))
  ORDER BY a.nome LIMIT 20;
END $$;

-- Aviso por push ao indicador quando converte (usa a função de push existente).
CREATE OR REPLACE FUNCTION public.trg_vendas_indicacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb; _pad uuid;
BEGIN
  BEGIN
    IF NEW.status_pagamento = 'pago' AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM 'pago') THEN
      _r := public.fn_indicacao_converter(NEW.id);
      IF coalesce((_r->>'ok')::boolean, false) THEN
        SELECT padrinho_id INTO _pad FROM public.clube_indicacoes WHERE id = (_r->>'id')::uuid;
        PERFORM public.fn_call_edge_function('send-push-notification', jsonb_build_object(
          'aluno_id', _pad, 'title', 'Indicação convertida',
          'body', CASE WHEN coalesce((_r->>'pontos')::int, 0) > 0
                       THEN 'Seu indicado contratou um plano FORTEM. Você recebeu ' || (_r->>'pontos') || ' pontos.'
                       ELSE 'Seu indicado contratou um plano FORTEM.' END,
          'url', '/portal/clube', 'gatilho', 'indicacao_convertida'));
      END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.status_pagamento = 'pago' AND NEW.status_pagamento IN ('estornado','cancelado') THEN
      PERFORM public.fn_indicacao_reverter(NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
    VALUES ('indicacoes', 'erro_gatilho_venda', SQLERRM, jsonb_build_object('venda_id', NEW.id, 'status', NEW.status_pagamento));
  END;
  RETURN NEW;
END $$;

-- Regras do portal incluem os valores de indicação.
CREATE OR REPLACE FUNCTION public.fn_clube_regras_portal()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'conquistas_bonus_desde', (SELECT valor FROM public.clube_config WHERE chave = 'conquistas_bonus_desde'),
    'mult_agregador', (SELECT valor::numeric FROM public.clube_config WHERE chave = 'mult_agregador'),
    'pontos_treino', (SELECT pontos FROM public.clube_regras_pontuacao WHERE acao = 'treino_realizado' AND ativo),
    'pontos_indicacao', (SELECT pontos FROM public.clube_regras_pontuacao WHERE acao = 'indicacao_convertida' AND ativo),
    'pontos_indicado', (SELECT pontos FROM public.clube_regras_pontuacao WHERE acao = 'indicado_bonus' AND ativo),
    'teto_indicacoes_ano', 10,
    'conquistas', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'descricao', descricao, 'pontos_bonus', pontos_bonus) ORDER BY created_at, nome), '[]'::jsonb)
                     FROM public.clube_badges WHERE ativo),
    'limites', (SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'limite_mensal', limite_mensal) ORDER BY nome), '[]'::jsonb)
                  FROM public.clube_recompensas WHERE ativo AND limite_mensal IS NOT NULL)
  ) END;
$$;

-- Portal: só o próprio código e as próprias indicações, com nome abreviado do indicado.
CREATE OR REPLACE FUNCTION public.fn_indicacao_minhas()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _aluno uuid := public.fn_current_aluno_id(); _ano int := extract(year FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
BEGIN
  IF _aluno IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'codigo', (SELECT codigo FROM public.clube_codigos_indicacao WHERE aluno_id = _aluno),
    'convertidas_ano', (SELECT count(*) FROM public.clube_indicacoes WHERE padrinho_id = _aluno AND status = 'convertida'
                          AND pontos_pagos > 0 AND extract(year FROM (convertido_em AT TIME ZONE 'America/Sao_Paulo'))::int = _ano),
    'indicacoes', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'nome', split_part(trim(a.nome), ' ', 1) ||
                CASE WHEN position(' ' IN trim(a.nome)) > 0
                     THEN ' ' || upper(left(regexp_replace(trim(a.nome), '^.*\s', ''), 1)) || '.' ELSE '' END,
        'status', i.status, 'pontos', i.pontos_pagos, 'sem_pontos_motivo', i.sem_pontos_motivo,
        'criada_em', i.criada_em, 'convertido_em', i.convertido_em) ORDER BY i.criada_em DESC), '[]'::jsonb)
      FROM public.clube_indicacoes i JOIN public.alunos a ON a.id = i.indicado_id
      WHERE i.padrinho_id = _aluno)
  );
END $$;

-- Equipe: lista com nomes (sem contato/CPF).
CREATE OR REPLACE FUNCTION public.fn_indicacoes_lista(
  p_status text DEFAULT NULL, p_padrinho uuid DEFAULT NULL, p_indicado uuid DEFAULT NULL,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL)
RETURNS TABLE (id uuid, padrinho_id uuid, padrinho_nome text, padrinho_ativo boolean, indicado_id uuid, indicado_nome text,
  indicado_status text, origem text, status text, pontos_pagos int, pontos_indicado int, sem_pontos_motivo text,
  motivo_recusa text, criada_em timestamptz, convertido_em timestamptz, expira_em timestamptz, venda_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT i.id, i.padrinho_id, p.nome::text, public.fn_indicacao_aluno_ativo(i.padrinho_id), i.indicado_id, d.nome::text,
    d.status::text, i.origem, i.status, i.pontos_pagos, i.pontos_indicado, i.sem_pontos_motivo, i.motivo_recusa,
    i.criada_em, i.convertido_em, i.expira_em, i.venda_id
  FROM public.clube_indicacoes i
  JOIN public.alunos p ON p.id = i.padrinho_id
  JOIN public.alunos d ON d.id = i.indicado_id
  WHERE (p_status IS NULL OR i.status = p_status)
    AND (p_padrinho IS NULL OR i.padrinho_id = p_padrinho)
    AND (p_indicado IS NULL OR i.indicado_id = p_indicado)
    AND (p_de IS NULL OR (i.criada_em AT TIME ZONE 'America/Sao_Paulo')::date >= p_de)
    AND (p_ate IS NULL OR (i.criada_em AT TIME ZONE 'America/Sao_Paulo')::date <= p_ate)
  ORDER BY i.criada_em DESC;
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacoes_resumo(p_de date, p_ate date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ano int := extract(year FROM coalesce(p_ate, CURRENT_DATE))::int; _ind int; _conv int;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT count(*), count(*) FILTER (WHERE status = 'convertida') INTO _ind, _conv FROM public.clube_indicacoes
   WHERE (criada_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_de AND p_ate;
  RETURN jsonb_build_object('indicacoes', _ind, 'convertidas', _conv,
    'taxa', CASE WHEN _ind > 0 THEN round(_conv * 100.0 / _ind, 1) ELSE 0 END,
    'pontos_pagos', (SELECT coalesce(sum(pontos_pagos), 0) FROM public.clube_indicacoes
                      WHERE status = 'convertida' AND (convertido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_de AND p_ate),
    'no_teto', (SELECT count(*) FROM (SELECT padrinho_id FROM public.clube_indicacoes
                 WHERE status = 'convertida' AND pontos_pagos > 0
                   AND extract(year FROM (convertido_em AT TIME ZONE 'America/Sao_Paulo'))::int = _ano
                 GROUP BY padrinho_id HAVING count(*) >= 10) t));
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacoes_sem_indicador()
RETURNS TABLE (aluno_id uuid, nome text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT a.id, a.nome::text, a.status::text, a.created_at
  FROM public.pipeline_metadata m JOIN public.alunos a ON a.id = m.aluno_id
  WHERE unaccent(lower(coalesce(m.origem_lead, ''))) LIKE 'indicacao%'
    AND NOT coalesce(a.is_equipe, false)
    AND NOT EXISTS (SELECT 1 FROM public.clube_indicacoes i WHERE i.indicado_id = a.id)
  ORDER BY a.created_at DESC;
END $$;

-- Carga dos prospects antigos: criada antes do corte, portanto sem pontos (anterior_ao_programa).
CREATE OR REPLACE FUNCTION public.fn_indicacao_vincular_antiga(p_indicado_id uuid, p_padrinho_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _corte timestamptz; _id uuid;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT nullif(valor, '')::timestamptz INTO _corte FROM public.clube_config WHERE chave = 'indicacoes_pontos_desde';
  PERFORM set_config('fortem.indicacao_carga', '1', true);
  INSERT INTO public.clube_indicacoes (padrinho_id, indicado_id, origem, created_by, criada_em)
  VALUES (p_padrinho_id, p_indicado_id, 'equipe', auth.uid(), coalesce(_corte, now()) - interval '1 second')
  RETURNING id INTO _id;
  PERFORM set_config('fortem.indicacao_carga', '', true);
  RETURN jsonb_build_object('ok', true, 'id', _id);
EXCEPTION
  WHEN unique_violation THEN RETURN jsonb_build_object('ok', false, 'erro', 'indicado_ja_tem_indicador');
  WHEN raise_exception THEN RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_recusar(p_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 3 THEN RETURN jsonb_build_object('ok', false, 'erro', 'motivo_obrigatorio'); END IF;
  UPDATE public.clube_indicacoes SET status = 'recusada', motivo_recusa = trim(p_motivo)
   WHERE id = p_id AND status = 'pendente';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'so_pendente'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_reverter_admin(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _venda uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT venda_id INTO _venda FROM public.clube_indicacoes WHERE id = p_id AND status = 'convertida';
  IF _venda IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'sem_indicacao'); END IF;
  RETURN public.fn_indicacao_reverter(_venda);
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_corrigir_indicador(p_id uuid, p_padrinho_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('fortem.indicacao_corrigir', '1', true);
  UPDATE public.clube_indicacoes SET padrinho_id = p_padrinho_id WHERE id = p_id AND status = 'pendente';
  IF NOT FOUND THEN PERFORM set_config('fortem.indicacao_corrigir', '', true);
    RETURN jsonb_build_object('ok', false, 'erro', 'so_pendente'); END IF;
  PERFORM set_config('fortem.indicacao_corrigir', '', true);
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN raise_exception THEN RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END $$;

REVOKE ALL ON FUNCTION public.fn_venda_plano_fortem(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_clube_indicacao_validar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_vendas_indicacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacao_buscar_indicador(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacao_minhas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacoes_lista(text, uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacoes_resumo(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacoes_sem_indicador() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacao_vincular_antiga(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacao_recusar(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacao_reverter_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacao_corrigir_indicador(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_buscar_indicador(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_minhas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacoes_lista(text, uuid, uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacoes_resumo(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacoes_sem_indicador() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_vincular_antiga(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_recusar(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_reverter_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_corrigir_indicador(uuid, uuid) TO authenticated, service_role;