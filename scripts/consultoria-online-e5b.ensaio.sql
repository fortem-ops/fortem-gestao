-- E5b ENSAIO — NÃO EXECUTADO. Rodar inteiro numa única transação; termina em ROLLBACK.
-- Aluno: NICOLAS TESTE (085acf57-2dbe-464d-9acc-e1b0f5b77032). Impressão digital sem ids/timestamps.
-- Roteiro:
--  F0  impressão digital "antes" (Start/Power/Pro: resultado das RPCs em cenário fixo, sem ids)
--  F1  aplica a proposta (A) dentro da transação
--  C1  só Consultoria Mensal vigente -> fn_agendar_treino e fn_agendar_servico devolvem somente_online;
--      contagem de treino_agendamentos/agenda_servicos/consumo_servicos/creditos_movimentos e saldo de ciclos_credito iguais
--  C2  Consultoria + Start vigentes -> agenda normal (ok=true)
--  C3  sem plano vigente -> mesmo erro de antes (não é somente_online)
--  C4  Start / Power / Pro: resultado das RPCs antes x depois idêntico (impressão digital)
--  C5  equipe (coordenador) agenda serviço para aluno só Consultoria via fn_agendar_servico_equipe -> ok=true
BEGIN;

CREATE TEMP TABLE _fp(caso text, etapa text, resultado text) ON COMMIT DROP;
CREATE TEMP TABLE _ctx AS SELECT
  '085acf57-2dbe-464d-9acc-e1b0f5b77032'::uuid AS aluno,
  (SELECT user_id FROM public.alunos WHERE id='085acf57-2dbe-464d-9acc-e1b0f5b77032') AS aluno_uid,
  (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin','coordenador') LIMIT 1) AS staff_uid,
  (SELECT id FROM public.treino_slots WHERE ativo LIMIT 1) AS slot,
  (SELECT id FROM public.agenda_servicos WHERE aluno_id IS NULL AND visivel_portal LIMIT 1) AS tpl;

-- Datas: próxima ocorrência do dia da semana do slot / do modelo (>= amanhã)
CREATE TEMP TABLE _datas AS SELECT
  (SELECT d::date FROM generate_series(current_date+1, current_date+7, '1 day') d, _ctx
     WHERE extract(dow FROM d)::int = (SELECT dia_semana FROM public.treino_slots WHERE id=_ctx.slot) LIMIT 1) AS d_treino,
  (current_date + 8) AS d_servico;  -- ajustar ao dia válido do modelo antes de rodar

CREATE OR REPLACE FUNCTION pg_temp.contagem() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|',
    (SELECT count(*) FROM public.treino_agendamentos WHERE aluno_id=(SELECT aluno FROM _ctx)),
    (SELECT count(*) FROM public.agenda_servicos     WHERE aluno_id=(SELECT aluno FROM _ctx)),
    (SELECT count(*) FROM public.consumo_servicos    WHERE aluno_id=(SELECT aluno FROM _ctx)),
    (SELECT count(*) FROM public.creditos_movimentos m JOIN public.creditos_aluno c ON c.id=m.credito_id WHERE c.aluno_id=(SELECT aluno FROM _ctx)),
    (SELECT coalesce(sum(creditos_usados),0) FROM public.ciclos_credito WHERE aluno_id=(SELECT aluno FROM _ctx)));
$$;

CREATE OR REPLACE FUNCTION pg_temp.como(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true),
         set_config('role','authenticated', true);
$$;
CREATE OR REPLACE FUNCTION pg_temp.limpo(j jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT (j - 'id' - 'agendamento_id')::text;  -- sem ids
$$;

-- Cenário de plano: desativa os planos vigentes do teste (desfeito no ROLLBACK) e cria o plano do caso
CREATE OR REPLACE FUNCTION pg_temp.cenario(familias text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE f text;
BEGIN
  RESET role;
  UPDATE public.planos SET ativo=false WHERE aluno_id=(SELECT aluno FROM _ctx) AND ativo;
  DELETE FROM public.treino_agendamentos WHERE aluno_id=(SELECT aluno FROM _ctx) AND data >= current_date;
  FOREACH f IN ARRAY familias LOOP
    INSERT INTO public.planos (aluno_id, catalogo_id, nome, atividade, ativo, data_inicio, data_fim)
    SELECT (SELECT aluno FROM _ctx), c.id, c.nome, c.atividade, true, current_date, current_date + 30
    FROM public.planos_catalogo c WHERE c.familia=f ORDER BY c.periodo_meses NULLS LAST LIMIT 1;
  END LOOP;
  -- ciclo de crédito presencial com saldo, se houver plano presencial (colunas conforme ciclos_credito)
END $$;

CREATE OR REPLACE FUNCTION pg_temp.rodar(caso text, etapa text, familias text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a text; r1 jsonb; r2 jsonb;
BEGIN
  PERFORM pg_temp.cenario(familias);
  a := pg_temp.contagem();
  PERFORM pg_temp.como((SELECT aluno_uid FROM _ctx));
  r1 := public.fn_agendar_treino((SELECT slot FROM _ctx), (SELECT d_treino FROM _datas));
  r2 := public.fn_agendar_servico((SELECT tpl FROM _ctx), (SELECT d_servico FROM _datas));
  RESET role;
  INSERT INTO _fp VALUES (caso, etapa, concat_ws(' || ', pg_temp.limpo(r1), pg_temp.limpo(r2),
    CASE WHEN a = pg_temp.contagem() THEN 'nada_gravado' ELSE 'gravou' END));
END $$;

-- F0: ANTES (funções atuais)
SELECT pg_temp.rodar('start','antes',ARRAY['start_2027']);
SELECT pg_temp.rodar('power','antes',ARRAY['power_2027']);
SELECT pg_temp.rodar('pro','antes',ARRAY['pro_2027']);
SELECT pg_temp.rodar('sem_plano','antes',ARRAY[]::text[]);

-- F1: aplicar aqui o conteúdo entre BEGIN/COMMIT de consultoria-online-e5b.proposta.sql (sem BEGIN/COMMIT)
\ir consultoria-online-e5b.proposta-corpo.sql

-- DEPOIS
SELECT pg_temp.rodar('start','depois',ARRAY['start_2027']);
SELECT pg_temp.rodar('power','depois',ARRAY['power_2027']);
SELECT pg_temp.rodar('pro','depois',ARRAY['pro_2027']);
SELECT pg_temp.rodar('sem_plano','depois',ARRAY[]::text[]);
SELECT pg_temp.rodar('consultoria_so','depois',ARRAY['consultoria_2027']);       -- esperado: somente_online x2 + nada_gravado
SELECT pg_temp.rodar('consultoria_start','depois',ARRAY['consultoria_2027','start_2027']); -- esperado: ok=true

-- C5: equipe agenda para aluno só Consultoria
SELECT pg_temp.cenario(ARRAY['consultoria_2027']);
SELECT pg_temp.como((SELECT staff_uid FROM _ctx));
INSERT INTO _fp SELECT 'equipe_consultoria','depois',
  pg_temp.limpo(public.fn_agendar_servico_equipe((SELECT tpl FROM _ctx),(SELECT aluno FROM _ctx),(SELECT d_servico FROM _datas)));
RESET role;

-- Verificações
SELECT caso, etapa, resultado FROM _fp ORDER BY caso, etapa;
SELECT a.caso, a.resultado = d.resultado AS identico
FROM _fp a JOIN _fp d ON d.caso=a.caso AND a.etapa='antes' AND d.etapa='depois';  -- todos devem ser true

ROLLBACK;
-- Depois do ROLLBACK: conferir contagens do NICOLAS TESTE iguais às de antes do ensaio.
