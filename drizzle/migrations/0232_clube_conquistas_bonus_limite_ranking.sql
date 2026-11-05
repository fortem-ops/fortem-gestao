-- PARTE 1: Evolução Real desativada (conquistas já ganhas permanecem).
UPDATE public.clube_badges SET ativo = false WHERE codigo = 'evoluiu';

-- PARTE 3: coluna de bônus.
ALTER TABLE public.clube_badges ADD COLUMN IF NOT EXISTS pontos_bonus integer NOT NULL DEFAULT 0;

-- PARTE 2: novas conquistas (Recovery fica de fora: não há registro confiável de sessões realizadas).
INSERT INTO public.clube_badges (codigo, nome, descricao, criterio, ativo, pontos_bonus) VALUES
 ('treinos_10','10 Treinos','Concedida ao completar 10 treinos realizados.','treinos_realizados >= 10',true,20),
 ('treinos_50','50 Treinos','Concedida ao completar 50 treinos realizados.','treinos_realizados >= 50',true,50),
 ('treinos_100','100 Treinos','Concedida ao completar 100 treinos realizados.','treinos_realizados >= 100',true,100),
 ('treinos_250','250 Treinos','Concedida ao completar 250 treinos realizados.','treinos_realizados >= 250',true,150),
 ('treinos_500','500 Treinos','Concedida ao completar 500 treinos realizados.','treinos_realizados >= 500',true,250),
 ('nutri_1','Primeira Consulta Nutricional','Concedida na primeira consulta de nutrição realizada.','consultas_nutricao >= 1',true,20),
 ('nutri_4','Acompanhamento Nutricional','Concedida ao completar 4 consultas de nutrição realizadas.','consultas_nutricao >= 4',true,40),
 ('nutri_8','Nutrição Consistente','Concedida ao completar 8 consultas de nutrição realizadas.','consultas_nutricao >= 8',true,80),
 ('reab_1','Primeira Sessão de Reabilitação','Concedida na primeira sessão de reabilitação realizada.','sessoes_reabilitacao >= 1',true,20),
 ('reab_5','Reabilitação em Andamento','Concedida ao completar 5 sessões de reabilitação realizadas.','sessoes_reabilitacao >= 5',true,40),
 ('reab_10','Reabilitação Concluída','Concedida ao completar 10 sessões de reabilitação realizadas.','sessoes_reabilitacao >= 10',true,80),
 ('avaliacao_1','Primeira Avaliação','Concedida na primeira avaliação funcional realizada.','avaliacoes_funcionais >= 1',true,0),
 ('avaliacao_em_dia','Avaliação em Dia','Concedida ao realizar 2 avaliações funcionais com intervalo de até 6 meses entre elas.','avaliacoes_funcionais_intervalo_6m',true,30),
 ('semanas_16','Maratona de Frequência','Concedida ao cumprir a frequência semanal do seu plano por 16 semanas seguidas.','semanas_seguidas >= 16',true,100),
 ('fortem_completo','Fortem Completo','Concedida ao fazer, no mesmo ano, pelo menos 1 treino, 1 consulta de nutrição e 1 sessão de reabilitação.','treino + nutricao + reabilitacao no mesmo ano',true,100)
ON CONFLICT DO NOTHING;

UPDATE public.clube_badges SET pontos_bonus = 20 WHERE codigo = 'mes_completo';
UPDATE public.clube_badges SET pontos_bonus = 50 WHERE codigo = 'sequencia_30';

-- PARTE 4: limite mensal.
ALTER TABLE public.clube_recompensas ADD COLUMN IF NOT EXISTS limite_mensal integer;
UPDATE public.clube_recompensas SET limite_mensal = 1 WHERE nome IN
 ('Sessão extra de treino','Desconto 20% em serviço','Sessão de Nutrição grátis','Sessão de Reabilitação grátis','Upgrade de frequência por 1 mês');

-- Bônus por conquista: lançado ao ganhar, só depois do corte, sem multiplicador de plano/clima; agregador x mult_agregador (para cima).
CREATE OR REPLACE FUNCTION public.fn_clube_badge_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.clube_badges%ROWTYPE; _corte timestamptz; _mult numeric := 1; _pts int; _val int;
BEGIN
  BEGIN
    SELECT * INTO _b FROM public.clube_badges WHERE id = NEW.badge_id;
    IF NOT FOUND OR coalesce(_b.pontos_bonus,0) <= 0 THEN RETURN NEW; END IF;
    SELECT valor::timestamptz INTO _corte FROM public.clube_config WHERE chave = 'conquistas_bonus_desde';
    IF _corte IS NULL OR NEW.conquistado_em <= _corte THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.clube_historico WHERE aluno_id = NEW.aluno_id AND acao = 'conquista' AND referencia_id = NEW.badge_id) THEN RETURN NEW; END IF;
    IF coalesce((public.fn_clube_plano_info(NEW.aluno_id)->>'agregador')::boolean, false) THEN
      SELECT coalesce(valor::numeric, 0.5) INTO _mult FROM public.clube_config WHERE chave = 'mult_agregador';
      _mult := coalesce(_mult, 0.5);
    END IF;
    _pts := ceil(_b.pontos_bonus * _mult)::int;
    SELECT coalesce(valor::int, 12) INTO _val FROM public.clube_config WHERE chave = 'pontos_validade_meses';
    _val := coalesce(_val, 12);
    INSERT INTO public.clube_pontos (aluno_id, total_acumulado, saldo, ultima_movimentacao, pontos_expiram_em)
    VALUES (NEW.aluno_id, _pts, _pts, now(), now() + make_interval(months => _val))
    ON CONFLICT (aluno_id) DO UPDATE SET total_acumulado = clube_pontos.total_acumulado + _pts,
      saldo = clube_pontos.saldo + _pts, ultima_movimentacao = now(),
      pontos_expiram_em = now() + make_interval(months => _val), updated_at = now();
    INSERT INTO public.clube_historico (aluno_id, acao, label, pontos, multiplicador, pontos_final, multiplicador_clima, motivo_manual, referencia_id, referencia_tipo)
    VALUES (NEW.aluno_id, 'conquista', 'Conquista: ' || _b.nome, _b.pontos_bonus, _mult, _pts, false,
      CASE WHEN _mult <> 1 THEN 'Agregador (50% do bônus)' END, NEW.badge_id, 'conquista');
  EXCEPTION WHEN others THEN
    RAISE WARNING 'fn_clube_badge_bonus: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clube_badge_bonus ON public.clube_aluno_badges;
CREATE TRIGGER trg_clube_badge_bonus AFTER INSERT ON public.clube_aluno_badges FOR EACH ROW EXECUTE FUNCTION public.fn_clube_badge_bonus();
REVOKE ALL ON FUNCTION public.fn_clube_badge_bonus() FROM PUBLIC, anon, authenticated;

-- Avaliação idempotente das conquistas (fontes: treino_agendamentos realizado; agenda_presencas comparecimento=true; avaliacoes funcionais).
CREATE OR REPLACE FUNCTION public.fn_clube_avaliar_conquistas(p_aluno_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t int; _n int; _r int; _a int; _sem int;
BEGIN
  IF p_aluno_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _t FROM public.treino_agendamentos WHERE aluno_id = p_aluno_id AND status = 'realizado';
  SELECT count(*) FILTER (WHERE a.atividade = 'Nutrição'), count(*) FILTER (WHERE a.atividade = 'Reabilitação')
    INTO _n, _r FROM public.agenda_presencas p JOIN public.agenda_servicos a ON a.id = p.agenda_id
   WHERE a.aluno_id = p_aluno_id AND p.comparecimento = true;
  SELECT count(*) INTO _a FROM public.avaliacoes WHERE aluno_id = p_aluno_id AND tipo IN ('funcional','funcional_v2');

  IF _t >= 10 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '10 Treinos'); END IF;
  IF _t >= 50 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '50 Treinos'); END IF;
  IF _t >= 100 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '100 Treinos'); END IF;
  IF _t >= 250 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '250 Treinos'); END IF;
  IF _t >= 500 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '500 Treinos'); END IF;
  IF _n >= 1 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Primeira Consulta Nutricional'); END IF;
  IF _n >= 4 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Acompanhamento Nutricional'); END IF;
  IF _n >= 8 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Nutrição Consistente'); END IF;
  IF _r >= 1 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Primeira Sessão de Reabilitação'); END IF;
  IF _r >= 5 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Reabilitação em Andamento'); END IF;
  IF _r >= 10 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Reabilitação Concluída'); END IF;
  IF _a >= 1 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Primeira Avaliação'); END IF;
  IF _a >= 2 AND EXISTS (
    SELECT 1 FROM (SELECT data, lag(data) OVER (ORDER BY data) ant FROM public.avaliacoes
                    WHERE aluno_id = p_aluno_id AND tipo IN ('funcional','funcional_v2')) x
     WHERE x.ant IS NOT NULL AND x.data <= (x.ant + interval '6 months')::date) THEN
    PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Avaliação em Dia');
  END IF;
  IF _t > 0 THEN
    _sem := public.fn_clube_semanas_seguidas(p_aluno_id);
    IF _sem >= 8 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, '8 Semanas Seguidas'); END IF;
    IF _sem >= 16 THEN PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Maratona de Frequência'); END IF;
  END IF;
  IF _t > 0 AND _n > 0 AND _r > 0 AND EXISTS (
    SELECT 1 FROM (SELECT DISTINCT extract(year FROM data)::int y FROM public.treino_agendamentos
                    WHERE aluno_id = p_aluno_id AND status = 'realizado') t
     WHERE EXISTS (SELECT 1 FROM public.agenda_presencas p JOIN public.agenda_servicos a ON a.id = p.agenda_id
                    WHERE a.aluno_id = p_aluno_id AND p.comparecimento AND a.atividade = 'Nutrição' AND extract(year FROM p.data)::int = t.y)
       AND EXISTS (SELECT 1 FROM public.agenda_presencas p JOIN public.agenda_servicos a ON a.id = p.agenda_id
                    WHERE a.aluno_id = p_aluno_id AND p.comparecimento AND a.atividade = 'Reabilitação' AND extract(year FROM p.data)::int = t.y)) THEN
    PERFORM public.fn_clube_conceder_badge(p_aluno_id, 'Fortem Completo');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.fn_clube_avaliar_conquistas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clube_avaliar_conquistas(uuid) TO service_role;

-- Treino realizado: mantém pontos/badges existentes e passa a avaliar as novas conquistas.
CREATE OR REPLACE FUNCTION public.fn_treino_agendamento_pontuar_clube()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'realizado' AND (OLD.status IS DISTINCT FROM 'realizado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clube_historico
      WHERE referencia_id = NEW.id AND referencia_tipo = 'treino_agendamento' AND acao = 'treino_realizado'
    ) THEN
      PERFORM public.fn_clube_adicionar_pontos(NEW.aluno_id, 'treino_realizado', NEW.id, 'treino_agendamento');
    END IF;
    PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, 'Primeiro Passo');
    IF EXISTS (SELECT 1 FROM public.clube_clima_cache c WHERE c.data = NEW.data AND c.multiplicador_ativo = true) THEN
      PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, 'Guerreiro da Chuva');
    END IF;
    BEGIN
      PERFORM public.fn_clube_avaliar_conquistas(NEW.aluno_id);
    EXCEPTION WHEN others THEN RAISE WARNING 'avaliar_conquistas: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

-- Presenças (nutrição/reabilitação) e avaliações funcionais: avaliam conquistas sem bloquear a gravação.
CREATE OR REPLACE FUNCTION public.fn_clube_conquistas_por_presenca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _aluno uuid;
BEGIN
  IF NEW.comparecimento IS TRUE THEN
    SELECT aluno_id INTO _aluno FROM public.agenda_servicos WHERE id = NEW.agenda_id AND atividade IN ('Nutrição','Reabilitação');
    IF _aluno IS NOT NULL THEN
      BEGIN PERFORM public.fn_clube_avaliar_conquistas(_aluno);
      EXCEPTION WHEN others THEN RAISE WARNING 'avaliar_conquistas: %', SQLERRM; END;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clube_conquistas_presenca ON public.agenda_presencas;
CREATE TRIGGER trg_clube_conquistas_presenca AFTER INSERT OR UPDATE OF comparecimento ON public.agenda_presencas
  FOR EACH ROW EXECUTE FUNCTION public.fn_clube_conquistas_por_presenca();
REVOKE ALL ON FUNCTION public.fn_clube_conquistas_por_presenca() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_clube_conquistas_por_avaliacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo IN ('funcional','funcional_v2') THEN
    BEGIN PERFORM public.fn_clube_avaliar_conquistas(NEW.aluno_id);
    EXCEPTION WHEN others THEN RAISE WARNING 'avaliar_conquistas: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clube_conquistas_avaliacao ON public.avaliacoes;
CREATE TRIGGER trg_clube_conquistas_avaliacao AFTER INSERT ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_clube_conquistas_por_avaliacao();
REVOKE ALL ON FUNCTION public.fn_clube_conquistas_por_avaliacao() FROM PUBLIC, anon, authenticated;

-- Corte: bônus só para conquistas ganhas depois deste instante; carga inicial (mesmo instante) não pontua.
INSERT INTO public.clube_config (chave, valor, descricao)
VALUES ('conquistas_bonus_desde', now()::text, 'Bônus de conquista só vale para conquistas ganhas depois desta data (sem retroativo).');
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.alunos LOOP PERFORM public.fn_clube_avaliar_conquistas(r.id); END LOOP;
END $$;

-- PARTE 4: resgate com limite mensal (mês-calendário America/Sao_Paulo).
CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _aluno_id uuid; _recompensa clube_recompensas%ROWTYPE;
  _pontos clube_pontos%ROWTYPE;
  _custo_final integer; _is_agregador boolean;
  _ini_mes date; _qtd int; _prox date;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida'); END IF;

  IF _recompensa.limite_mensal IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(_aluno_id::text || p_recompensa_id::text));
    _ini_mes := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
    _prox := (_ini_mes + interval '1 month')::date;
    SELECT count(*) INTO _qtd FROM clube_resgates
     WHERE aluno_id = _aluno_id AND recompensa_id = p_recompensa_id AND status <> 'cancelado'
       AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= _ini_mes;
    IF _qtd >= _recompensa.limite_mensal THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'limite_mensal', 'disponivel_em', _prox,
        'mensagem', 'Você já resgatou esta recompensa este mês. Disponível novamente em ' || to_char(_prox, 'DD/MM/YYYY') || '.');
    END IF;
  END IF;

  _is_agregador := COALESCE((public.fn_clube_plano_info(_aluno_id)->>'agregador')::boolean, false);

  _custo_final := CASE
    WHEN _is_agregador THEN COALESCE(_recompensa.custo_agregador, ROUND(COALESCE(_recompensa.custo_start, _recompensa.custo_pontos) * 1.3))
    ELSE COALESCE(_recompensa.custo_start, _recompensa.custo_pontos)
  END;

  SELECT * INTO _pontos FROM clube_pontos WHERE aluno_id = _aluno_id;
  IF NOT FOUND OR _pontos.saldo < _custo_final THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'saldo_insuficiente', 'saldo', COALESCE(_pontos.saldo, 0), 'custo', _custo_final);
  END IF;

  UPDATE clube_pontos SET saldo = saldo - _custo_final,
    total_resgatado = total_resgatado + _custo_final, updated_at = now()
  WHERE aluno_id = _aluno_id;

  INSERT INTO clube_resgates (aluno_id, recompensa_id, pontos_utilizados, status)
  VALUES (_aluno_id, p_recompensa_id, _custo_final,
    CASE WHEN _recompensa.tipo = 'automatico' THEN 'aprovado' ELSE 'pendente' END);

  INSERT INTO clube_historico (aluno_id, acao, label, pontos, pontos_final)
  VALUES (_aluno_id, 'resgate', 'Resgate: ' || _recompensa.nome, -_custo_final, -_custo_final);

  RETURN jsonb_build_object('ok', true, 'tipo', _recompensa.tipo, 'recompensa', _recompensa.nome, 'custo', _custo_final, 'is_agregador', _is_agregador);
END; $function$;

-- Limite atingido por recompensa no mês corrente (para desabilitar o botão no portal).
CREATE OR REPLACE FUNCTION public.fn_clube_resgates_limite_mes()
RETURNS TABLE(recompensa_id uuid, resgates_mes int, limite_mensal int, disponivel_em date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ini AS (SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date d)
  SELECT r.id, count(s.id)::int, r.limite_mensal, (ini.d + interval '1 month')::date
    FROM public.clube_recompensas r CROSS JOIN ini
    LEFT JOIN public.clube_resgates s ON s.recompensa_id = r.id AND s.aluno_id = public.fn_current_aluno_id()
      AND s.status <> 'cancelado' AND (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ini.d
   WHERE r.ativo AND r.limite_mensal IS NOT NULL AND public.fn_current_aluno_id() IS NOT NULL
   GROUP BY r.id, r.limite_mensal, ini.d;
$$;
REVOKE ALL ON FUNCTION public.fn_clube_resgates_limite_mes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clube_resgates_limite_mes() TO authenticated;

-- Valores das regras para o portal (aluno não lê clube_config direto).
CREATE OR REPLACE FUNCTION public.fn_clube_regras_portal()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'conquistas_bonus_desde', (SELECT valor FROM public.clube_config WHERE chave = 'conquistas_bonus_desde'),
    'mult_agregador', (SELECT valor::numeric FROM public.clube_config WHERE chave = 'mult_agregador'),
    'pontos_treino', (SELECT pontos FROM public.clube_regras_pontuacao WHERE acao = 'treino_realizado' AND ativo),
    'conquistas', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'descricao', descricao, 'pontos_bonus', pontos_bonus) ORDER BY created_at, nome), '[]'::jsonb)
                     FROM public.clube_badges WHERE ativo),
    'limites', (SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'limite_mensal', limite_mensal) ORDER BY nome), '[]'::jsonb)
                  FROM public.clube_recompensas WHERE ativo AND limite_mensal IS NOT NULL)
  ) END;
$$;
REVOKE ALL ON FUNCTION public.fn_clube_regras_portal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clube_regras_portal() TO authenticated;

-- PARTE 6: ranking geral por dias de treino realizados no mês (America/Sao_Paulo), só quem tem consentimento ativo.
CREATE OR REPLACE FUNCTION public.fn_comunidade_ranking_geral()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _eu uuid := public.fn_comunidade_meu_aluno(); _ini date; _res jsonb; _eu_j jsonb; _participa boolean;
BEGIN
  IF auth.uid() IS NULL OR (_eu IS NULL AND NOT public.is_staff()) THEN
    RAISE EXCEPTION 'sem_acesso_ranking' USING ERRCODE = '42501';
  END IF;
  _ini := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  _participa := _eu IS NOT NULL AND EXISTS (SELECT 1 FROM public.comunidade_consentimentos c
                  WHERE c.aluno_id = _eu AND c.revogado_em IS NULL AND c.suspenso_em IS NULL);
  WITH part AS (
    SELECT DISTINCT c.aluno_id FROM public.comunidade_consentimentos c
     WHERE c.revogado_em IS NULL AND c.suspenso_em IS NULL
  ), cont AS (
    SELECT p.aluno_id, a.nome,
      (SELECT count(DISTINCT t.data) FROM public.treino_agendamentos t WHERE t.aluno_id = p.aluno_id AND t.status = 'realizado'
          AND t.data >= _ini AND t.data < (_ini + interval '1 month')::date)::int mes,
      (SELECT count(DISTINCT t.data) FROM public.treino_agendamentos t WHERE t.aluno_id = p.aluno_id AND t.status = 'realizado')::int total
    FROM part p JOIN public.alunos a ON a.id = p.aluno_id
  ), rk AS (
    SELECT cont.*, (rank() OVER (ORDER BY mes DESC))::int pos FROM cont WHERE mes > 0
  )
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object('posicao', pos, 'nome', public.fn_comunidade_nome_abreviado(nome),
        'treinos_mes', mes, 'treinos_total', total, 'eh_voce', aluno_id = _eu) ORDER BY pos, public.fn_comunidade_nome_abreviado(nome)), '[]'::jsonb)
       FROM rk WHERE pos <= 10),
    (SELECT jsonb_build_object('posicao', pos) FROM rk WHERE aluno_id = _eu)
  INTO _res, _eu_j;
  RETURN jsonb_build_object('top', _res,
    'eu', CASE WHEN _eu IS NULL THEN NULL ELSE jsonb_build_object(
      'participa', _participa,
      'posicao', CASE WHEN _participa THEN (_eu_j->>'posicao')::int END,
      'nome', (SELECT public.fn_comunidade_nome_abreviado(nome) FROM public.alunos WHERE id = _eu),
      'treinos_mes', (SELECT count(DISTINCT t.data) FROM public.treino_agendamentos t WHERE t.aluno_id = _eu AND t.status = 'realizado'
          AND t.data >= _ini AND t.data < (_ini + interval '1 month')::date)::int,
      'treinos_total', (SELECT count(DISTINCT t.data) FROM public.treino_agendamentos t WHERE t.aluno_id = _eu AND t.status = 'realizado')::int
    ) END);
END $$;
REVOKE ALL ON FUNCTION public.fn_comunidade_ranking_geral() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_comunidade_ranking_geral() TO authenticated;