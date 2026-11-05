-- Programa de Indicação, etapa 1: modelo, códigos, conversão automática e pontos.

ALTER TABLE public.clube_indicacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'equipe',
  ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS criada_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_recusa text,
  ADD COLUMN IF NOT EXISTS pontos_pagos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_indicado integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sem_pontos_motivo text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.clube_indicacoes DROP CONSTRAINT IF EXISTS clube_indicacoes_status_check;
ALTER TABLE public.clube_indicacoes ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE public.clube_indicacoes ADD CONSTRAINT clube_indicacoes_status_check
  CHECK (status IN ('pendente','convertida','recusada','expirada'));
ALTER TABLE public.clube_indicacoes ADD CONSTRAINT clube_indicacoes_origem_check
  CHECK (origem IN ('equipe','codigo','link'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_indicacoes_indicado ON public.clube_indicacoes(indicado_id) WHERE indicado_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clube_indicacoes_venda ON public.clube_indicacoes(venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clube_indicacoes_pendentes ON public.clube_indicacoes(expira_em) WHERE status = 'pendente';

COMMENT ON COLUMN public.clube_indicacoes.codigo IS 'DEPRECATED: código por aluno fica em clube_codigos_indicacao';
COMMENT ON COLUMN public.clube_indicacoes.created_at IS 'DEPRECATED: usar criada_em';

INSERT INTO public.clube_config (chave, valor)
SELECT 'indicacoes_pontos_desde', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
WHERE NOT EXISTS (SELECT 1 FROM public.clube_config WHERE chave = 'indicacoes_pontos_desde');

CREATE TABLE IF NOT EXISTS public.clube_codigos_indicacao (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clube_codigos_indicacao TO authenticated;
GRANT ALL ON public.clube_codigos_indicacao TO service_role;
ALTER TABLE public.clube_codigos_indicacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_le_proprio_codigo" ON public.clube_codigos_indicacao
  FOR SELECT TO authenticated USING (aluno_id = public.fn_current_aluno_id());
CREATE POLICY "staff_le_codigos" ON public.clube_codigos_indicacao
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.fn_indicacao_gerar_codigo()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _alfa constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _b bytea; _c text; i int;
BEGIN
  LOOP
    _b := uuid_send(gen_random_uuid());
    _c := '';
    FOR i IN 0..7 LOOP
      _c := _c || substr(_alfa, (get_byte(_b, i) % 32) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clube_codigos_indicacao WHERE codigo = _c);
  END LOOP;
  RETURN _c;
END $$;

CREATE OR REPLACE FUNCTION public.trg_aluno_codigo_indicacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce(NEW.is_equipe, false) THEN
    INSERT INTO public.clube_codigos_indicacao (aluno_id, codigo)
    VALUES (NEW.id, public.fn_indicacao_gerar_codigo())
    ON CONFLICT (aluno_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER aluno_codigo_indicacao_ins AFTER INSERT ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.trg_aluno_codigo_indicacao();

INSERT INTO public.clube_codigos_indicacao (aluno_id, codigo)
SELECT a.id, public.fn_indicacao_gerar_codigo()
FROM public.alunos a
WHERE NOT coalesce(a.is_equipe, false)
  AND NOT EXISTS (SELECT 1 FROM public.clube_codigos_indicacao c WHERE c.aluno_id = a.id);

CREATE OR REPLACE FUNCTION public.fn_indicacao_aluno_ativo(p_aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.planos p
    WHERE p.aluno_id = p_aluno_id AND p.ativo = true
      AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE OR coalesce(p.renovacao_automatica, false))
  )
$$;

CREATE OR REPLACE FUNCTION public.fn_venda_plano_fortem(p_venda_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo text; _nome text; _fam text;
BEGIN
  SELECT v.tipo::text, lower(coalesce(pc.nome, v.nome_snapshot, '')), lower(coalesce(pc.familia, ''))
    INTO _tipo, _nome, _fam
  FROM public.vendas v LEFT JOIN public.planos_catalogo pc ON pc.id = v.catalogo_id
  WHERE v.id = p_venda_id;
  IF NOT FOUND OR _tipo <> 'plano' THEN RETURN false; END IF;
  IF _nome ~ '(corrida|wellhub|gympass|total\s*pass|consultoria)' OR _fam ~ '(corrida|consultoria)' THEN RETURN false; END IF;
  RETURN _fam ~ '^(start|power|pro)' OR _nome ~ '(^|[^a-z])(start|power|pro|max|vip)([^a-z]|$)';
END $$;

CREATE OR REPLACE FUNCTION public.trg_clube_indicacao_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.indicado_id IS NULL THEN RAISE EXCEPTION 'indicado_obrigatorio' USING ERRCODE = 'P0001'; END IF;
    IF NEW.padrinho_id = NEW.indicado_id THEN RAISE EXCEPTION 'auto_indicacao' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.alunos WHERE id = NEW.padrinho_id AND coalesce(is_equipe, false)) THEN
      RAISE EXCEPTION 'indicador_equipe' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.alunos WHERE id = NEW.indicado_id AND coalesce(is_equipe, false)) THEN
      RAISE EXCEPTION 'indicado_equipe' USING ERRCODE = 'P0001'; END IF;
    IF public.fn_indicacao_aluno_ativo(NEW.indicado_id) THEN
      RAISE EXCEPTION 'indicado_ja_ativo' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.clube_indicacoes WHERE indicado_id = NEW.indicado_id) THEN
      RAISE EXCEPTION 'indicado_ja_tem_indicador' USING ERRCODE = 'P0001'; END IF;
    NEW.status := 'pendente';
    NEW.venda_id := NULL; NEW.convertido_em := NULL;
    NEW.pontos_pagos := 0; NEW.pontos_indicado := 0;
  ELSE
    IF NEW.padrinho_id IS DISTINCT FROM OLD.padrinho_id OR NEW.indicado_id IS DISTINCT FROM OLD.indicado_id THEN
      RAISE EXCEPTION 'indicacao_imutavel' USING ERRCODE = 'P0001'; END IF;
  END IF;
  NEW.expira_em := NEW.criada_em + interval '90 days';
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_clube_indicacao_validar BEFORE INSERT OR UPDATE ON public.clube_indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_clube_indicacao_validar();

CREATE OR REPLACE FUNCTION public.fn_indicacao_registrar(
  p_indicado_id uuid, p_padrinho_id uuid DEFAULT NULL, p_codigo text DEFAULT NULL, p_origem text DEFAULT 'equipe')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _padrinho uuid := p_padrinho_id; _id uuid;
BEGIN
  IF NOT (public.is_staff() OR coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres','supabase_admin')) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  IF _padrinho IS NULL AND p_codigo IS NOT NULL THEN
    SELECT aluno_id INTO _padrinho FROM public.clube_codigos_indicacao WHERE codigo = upper(trim(p_codigo));
  END IF;
  IF _padrinho IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'indicador_nao_encontrado'); END IF;
  INSERT INTO public.clube_indicacoes (padrinho_id, indicado_id, origem, created_by)
  VALUES (_padrinho, p_indicado_id, coalesce(p_origem, 'equipe'), auth.uid())
  RETURNING id INTO _id;
  RETURN jsonb_build_object('ok', true, 'id', _id);
EXCEPTION
  WHEN unique_violation THEN RETURN jsonb_build_object('ok', false, 'erro', 'indicado_ja_tem_indicador');
  WHEN raise_exception THEN RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_buscar_indicador(p_termo text)
RETURNS TABLE (aluno_id uuid, nome text, ativo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_termo, ''))) < 3 THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.id, a.nome::text, public.fn_indicacao_aluno_ativo(a.id)
  FROM public.alunos a
  LEFT JOIN public.clube_codigos_indicacao c ON c.aluno_id = a.id
  WHERE NOT coalesce(a.is_equipe, false)
    AND a.status NOT IN ('lead','prospect')
    AND (unaccent(a.nome) ILIKE '%' || unaccent(trim(p_termo)) || '%' OR c.codigo = upper(trim(p_termo)))
  ORDER BY a.nome LIMIT 20;
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_estornar_pontos(p_indicacao_id uuid, p_aluno_id uuid, p_acao text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _liq int; _saldo int; _deb int;
BEGIN
  SELECT coalesce(sum(pontos_final), 0) INTO _liq FROM public.clube_historico
   WHERE aluno_id = p_aluno_id AND acao = p_acao AND referencia_id = p_indicacao_id AND referencia_tipo = 'indicacao';
  IF _liq <= 0 THEN RETURN 0; END IF;
  SELECT saldo INTO _saldo FROM public.clube_pontos WHERE aluno_id = p_aluno_id FOR UPDATE;
  _deb := least(_liq, greatest(coalesce(_saldo, 0), 0));
  UPDATE public.clube_pontos SET saldo = saldo - _deb, total_acumulado = greatest(total_acumulado - _deb, 0),
    ultima_movimentacao = now(), updated_at = now() WHERE aluno_id = p_aluno_id;
  INSERT INTO public.clube_historico (aluno_id, acao, label, pontos, multiplicador, pontos_final,
    multiplicador_clima, motivo_manual, referencia_id, referencia_tipo)
  SELECT p_aluno_id, p_acao, 'Estorno: ' || coalesce(r.label, p_acao), -_liq, 1, -_deb, false,
    CASE WHEN _deb < _liq THEN 'Estorno de indicação; ' || (_liq - _deb) || ' pontos não estornados por falta de saldo'
         ELSE 'Estorno de indicação' END,
    p_indicacao_id, 'indicacao'
  FROM (SELECT 1) x LEFT JOIN public.clube_regras_pontuacao r ON r.acao = p_acao;
  RETURN _deb;
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_converter(p_venda_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _v public.vendas; _ind public.clube_indicacoes;
  _corte timestamptz; _motivo text; _base int; _pts int := 0; _pts_ind int := 0;
  _info jsonb; _mult_ag numeric; _ano int; _r jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.clube_indicacoes WHERE venda_id = p_venda_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'venda_ja_processada'); END IF;
  SELECT * INTO _v FROM public.vendas WHERE id = p_venda_id;
  IF NOT FOUND OR _v.status_pagamento <> 'pago' OR NOT public.fn_venda_plano_fortem(p_venda_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'venda_nao_elegivel'); END IF;

  SELECT * INTO _ind FROM public.clube_indicacoes
   WHERE indicado_id = _v.aluno_id AND status = 'pendente' AND expira_em > now()
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'sem_indicacao_pendente'); END IF;

  UPDATE public.clube_indicacoes SET status = 'convertida', venda_id = p_venda_id, convertido_em = now(),
    sem_pontos_motivo = NULL, pontos_pagos = 0, pontos_indicado = 0
  WHERE id = _ind.id;

  SELECT nullif(valor, '')::timestamptz INTO _corte FROM public.clube_config WHERE chave = 'indicacoes_pontos_desde';
  IF _corte IS NULL OR _ind.criada_em < _corte THEN
    UPDATE public.clube_indicacoes SET sem_pontos_motivo = 'anterior_ao_programa' WHERE id = _ind.id;
    RETURN jsonb_build_object('ok', true, 'id', _ind.id, 'pontos', 0, 'sem_pontos_motivo', 'anterior_ao_programa');
  END IF;

  _ano := extract(year FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  IF NOT public.fn_indicacao_aluno_ativo(_ind.padrinho_id) THEN
    _motivo := 'indicador_inativo';
  ELSIF (SELECT count(*) FROM public.clube_indicacoes
          WHERE padrinho_id = _ind.padrinho_id AND status = 'convertida' AND pontos_pagos > 0 AND id <> _ind.id
            AND extract(year FROM (convertido_em AT TIME ZONE 'America/Sao_Paulo'))::int = _ano) >= 10 THEN
    _motivo := 'teto_anual';
  ELSIF (SELECT coalesce(sum(pontos_final), 0) FROM public.clube_historico
          WHERE aluno_id = _ind.padrinho_id AND acao = 'indicacao_convertida'
            AND referencia_id = _ind.id AND referencia_tipo = 'indicacao') > 0 THEN
    _motivo := 'ja_pago';
  ELSE
    SELECT pontos INTO _base FROM public.clube_regras_pontuacao WHERE acao = 'indicacao_convertida' AND ativo;
    IF _base IS NOT NULL THEN
      _info := public.fn_clube_plano_info(_ind.padrinho_id);
      IF coalesce((_info->>'agregador')::boolean, false) THEN
        SELECT valor::numeric INTO _mult_ag FROM public.clube_config WHERE chave = 'mult_agregador';
        _base := ceil(_base * coalesce(_mult_ag, 0.5))::int;
      END IF;
      _r := public.fn_clube_adicionar_pontos(_ind.padrinho_id, 'indicacao_convertida', _ind.id, 'indicacao',
              'Indicação convertida', NULL, _base);
      IF coalesce((_r->>'ok')::boolean, false) THEN _pts := (_r->>'pontos_adicionados')::int; END IF;
    END IF;
  END IF;

  IF (SELECT coalesce(sum(pontos_final), 0) FROM public.clube_historico
       WHERE aluno_id = _ind.indicado_id AND acao = 'indicado_bonus'
         AND referencia_id = _ind.id AND referencia_tipo = 'indicacao') <= 0 THEN
    SELECT pontos INTO _base FROM public.clube_regras_pontuacao WHERE acao = 'indicado_bonus' AND ativo;
    IF _base IS NOT NULL THEN
      _r := public.fn_clube_adicionar_pontos(_ind.indicado_id, 'indicado_bonus', _ind.id, 'indicacao',
              'Bônus de indicado', NULL, _base);
      IF coalesce((_r->>'ok')::boolean, false) THEN _pts_ind := (_r->>'pontos_adicionados')::int; END IF;
    END IF;
  END IF;

  UPDATE public.clube_indicacoes SET pontos_pagos = _pts, pontos_indicado = _pts_ind, sem_pontos_motivo = _motivo
  WHERE id = _ind.id;
  RETURN jsonb_build_object('ok', true, 'id', _ind.id, 'pontos', _pts, 'pontos_indicado', _pts_ind, 'sem_pontos_motivo', _motivo);
END $$;

CREATE OR REPLACE FUNCTION public.fn_indicacao_reverter(p_venda_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ind public.clube_indicacoes; _d1 int; _d2 int; _novo text;
BEGIN
  SELECT * INTO _ind FROM public.clube_indicacoes WHERE venda_id = p_venda_id AND status = 'convertida' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'sem_indicacao'); END IF;
  IF now() - _ind.convertido_em > interval '30 days' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'fora_do_prazo'); END IF;
  _d1 := public.fn_indicacao_estornar_pontos(_ind.id, _ind.padrinho_id, 'indicacao_convertida');
  _d2 := public.fn_indicacao_estornar_pontos(_ind.id, _ind.indicado_id, 'indicado_bonus');
  _novo := CASE WHEN now() < _ind.expira_em THEN 'pendente' ELSE 'expirada' END;
  UPDATE public.clube_indicacoes SET status = _novo, venda_id = NULL, convertido_em = NULL,
    pontos_pagos = 0, pontos_indicado = 0, sem_pontos_motivo = NULL
  WHERE id = _ind.id;
  RETURN jsonb_build_object('ok', true, 'id', _ind.id, 'status', _novo, 'estornado_indicador', _d1, 'estornado_indicado', _d2);
END $$;

CREATE OR REPLACE FUNCTION public.trg_vendas_indicacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status_pagamento = 'pago' AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM 'pago') THEN
      PERFORM public.fn_indicacao_converter(NEW.id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status_pagamento = 'pago' AND NEW.status_pagamento IN ('estornado','cancelado') THEN
      PERFORM public.fn_indicacao_reverter(NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
    VALUES ('indicacoes', 'erro_gatilho_venda', SQLERRM, jsonb_build_object('venda_id', NEW.id, 'status', NEW.status_pagamento));
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vendas_indicacao AFTER INSERT OR UPDATE OF status_pagamento ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.trg_vendas_indicacao();

CREATE OR REPLACE FUNCTION public.fn_indicacoes_expirar()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  UPDATE public.clube_indicacoes SET status = 'expirada' WHERE status = 'pendente' AND expira_em <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.fn_clube_indicacao_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total int;
BEGIN
  IF NEW.status = 'convertida' AND NEW.venda_id IS NOT NULL THEN
    SELECT count(*) INTO _total FROM public.clube_indicacoes i
     JOIN public.vendas v ON v.id = i.venda_id AND v.status_pagamento = 'pago'
     WHERE i.padrinho_id = NEW.padrinho_id AND i.status = 'convertida';
    IF _total >= 3 THEN PERFORM public.fn_clube_conceder_badge(NEW.padrinho_id, 'Embaixador FORTEM'); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_desafio_calcular_progresso(p_desafio_id uuid, p_aluno_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d clube_desafios%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM clube_desafios WHERE id = p_desafio_id;
  IF NOT FOUND OR p_aluno_id IS NULL THEN RETURN 0; END IF;
  IF _d.tipo_meta = 'indicacoes_convertidas' THEN
    RETURN (SELECT count(*)::int FROM clube_indicacoes
             WHERE padrinho_id = p_aluno_id AND status = 'convertida'
               AND (convertido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _d.data_inicio AND _d.data_fim);
  END IF;
  RETURN public.fn_desafio_calcular_progresso(p_desafio_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_desafio_calcular_progresso(p_desafio_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _desafio clube_desafios%ROWTYPE;
  _progresso integer := 0;
BEGIN
  SELECT * INTO _desafio FROM clube_desafios WHERE id = p_desafio_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  _progresso := CASE _desafio.tipo_meta
    WHEN 'treinos_realizados' THEN (
      SELECT COUNT(*)::integer FROM treino_agendamentos
      WHERE status IN ('realizado', 'confirmado')
      AND data BETWEEN _desafio.data_inicio AND _desafio.data_fim
    )
    WHEN 'avaliacoes_funcionais' THEN (
      SELECT COUNT(*)::integer FROM avaliacoes
      WHERE tipo IN ('funcional_v2', 'funcional')
      AND data::date BETWEEN _desafio.data_inicio AND _desafio.data_fim
    )
    WHEN 'indicacoes_convertidas' THEN (
      SELECT COUNT(*)::integer FROM clube_indicacoes i
      WHERE i.status = 'convertida'
      AND (i.convertido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _desafio.data_inicio AND _desafio.data_fim
      AND EXISTS (SELECT 1 FROM alunos a JOIN planos p ON p.aluno_id = a.id AND p.ativo = true
                  WHERE a.id = i.padrinho_id AND a.status = 'ativo')
    )
    WHEN 'checkins_semana' THEN (
      SELECT COUNT(*)::integer FROM treino_agendamentos
      WHERE status IN ('realizado', 'confirmado')
      AND data BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE
    )
    ELSE 0
  END;

  RETURN _progresso;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_indicacao_gerar_codigo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_aluno_codigo_indicacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_clube_indicacao_validar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_vendas_indicacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacao_aluno_ativo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_venda_plano_fortem(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacao_estornar_pontos(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacao_converter(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacao_reverter(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacoes_expirar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_clube_indicacao_badge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_desafio_calcular_progresso(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_indicacao_registrar(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_indicacao_buscar_indicador(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_registrar(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_buscar_indicador(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_desafio_calcular_progresso(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_converter(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacao_reverter(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_indicacoes_expirar() TO service_role;