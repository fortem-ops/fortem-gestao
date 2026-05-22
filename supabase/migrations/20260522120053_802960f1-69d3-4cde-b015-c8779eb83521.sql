
CREATE TABLE IF NOT EXISTS public.cancelamento_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.cancelamento_motivos (slug, nome, ordem) VALUES
  ('financeiro','Financeiro',1),('mudanca_rotina','Mudança de rotina',2),('lesao','Lesão',3),
  ('mudanca_cidade','Mudança de cidade',4),('falta_tempo','Falta de tempo',5),
  ('insatisfacao','Insatisfação',6),('migracao_wellhub','Migração Wellhub/TotalPass',7),
  ('outros','Outros',99)
ON CONFLICT (slug) DO NOTHING;
ALTER TABLE public.cancelamento_motivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_motivos" ON public.cancelamento_motivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_motivos" ON public.cancelamento_motivos FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS motivo_cancelamento_id uuid REFERENCES public.cancelamento_motivos(id),
  ADD COLUMN IF NOT EXISTS observacao_cancelamento text,
  ADD COLUMN IF NOT EXISTS data_cancelamento timestamptz;

CREATE OR REPLACE FUNCTION public.fn_vendas_valida_cancelamento()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status_pagamento = 'cancelado' AND NEW.motivo_cancelamento_id IS NULL THEN
    RAISE EXCEPTION 'Motivo de cancelamento é obrigatório';
  END IF;
  IF NEW.status_pagamento = 'cancelado' AND NEW.data_cancelamento IS NULL THEN
    NEW.data_cancelamento := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vendas_valida_cancelamento ON public.vendas;
CREATE TRIGGER trg_vendas_valida_cancelamento BEFORE INSERT OR UPDATE OF status_pagamento, motivo_cancelamento_id ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.fn_vendas_valida_cancelamento();

CREATE TABLE IF NOT EXISTS public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  forma_pagamento text, parcelas_qtd integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'em_dia' CHECK (status IN ('em_dia','parcial','vencido','quitado','cancelado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pag_aluno ON public.pagamentos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_pag_status ON public.pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pag_venda ON public.pagamentos(venda_id);
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_pag" ON public.pagamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "coord_manage_pag" ON public.pagamentos FOR ALL TO authenticated
  USING (is_coordinator_or_admin(auth.uid())) WITH CHECK (is_coordinator_or_admin(auth.uid()));
CREATE TRIGGER trg_pag_updated_at BEFORE UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pagamento_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  numero integer NOT NULL, valor numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL, data_pagamento date,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pago','vencido','cancelado')),
  forma_pagamento text, comprovante_url text, observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pagamento_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_par_status_venc ON public.pagamento_parcelas(status, vencimento);
CREATE INDEX IF NOT EXISTS idx_par_pag ON public.pagamento_parcelas(pagamento_id);
ALTER TABLE public.pagamento_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_par" ON public.pagamento_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "coord_manage_par" ON public.pagamento_parcelas FOR ALL TO authenticated
  USING (is_coordinator_or_admin(auth.uid())) WITH CHECK (is_coordinator_or_admin(auth.uid()));
CREATE TRIGGER trg_par_updated_at BEFORE UPDATE ON public.pagamento_parcelas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fn_recalc_pagamento_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_pag_id uuid; v_total int; v_pagas int; v_venc int; v_canc int; v_status text;
BEGIN
  v_pag_id := COALESCE(NEW.pagamento_id, OLD.pagamento_id);
  SELECT count(*), count(*) FILTER (WHERE status='pago'),
         count(*) FILTER (WHERE status='vencido'), count(*) FILTER (WHERE status='cancelado')
    INTO v_total, v_pagas, v_venc, v_canc
  FROM public.pagamento_parcelas WHERE pagamento_id = v_pag_id;
  v_status := CASE
    WHEN v_total = 0 THEN 'em_dia'
    WHEN v_canc = v_total THEN 'cancelado'
    WHEN v_pagas = v_total THEN 'quitado'
    WHEN v_venc > 0 THEN 'vencido'
    WHEN v_pagas > 0 THEN 'parcial'
    ELSE 'em_dia' END;
  UPDATE public.pagamentos SET status = v_status, updated_at = now() WHERE id = v_pag_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_par_recalc ON public.pagamento_parcelas;
CREATE TRIGGER trg_par_recalc AFTER INSERT OR UPDATE OR DELETE ON public.pagamento_parcelas
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_pagamento_status();

CREATE OR REPLACE FUNCTION public.fn_marcar_parcelas_vencidas()
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.pagamento_parcelas SET status='vencido', updated_at=now()
   WHERE status='aberto' AND vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END $$;

CREATE TABLE IF NOT EXISTS public.cobranca_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id uuid NOT NULL REFERENCES public.pagamento_parcelas(id) ON DELETE CASCADE,
  canal text NOT NULL, resultado text, observacao text, criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cobranca_tentativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_cob" ON public.cobranca_tentativas FOR SELECT TO authenticated USING (true);
CREATE POLICY "coord_manage_cob" ON public.cobranca_tentativas FOR ALL TO authenticated
  USING (is_coordinator_or_admin(auth.uid())) WITH CHECK (is_coordinator_or_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.relatorios_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL, descricao text,
  severidade text NOT NULL DEFAULT 'info' CHECK (severidade IN ('info','sucesso','aviso','critico')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  periodo_inicio date, periodo_fim date, gerado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.relatorios_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_insights" ON public.relatorios_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_insights" ON public.relatorios_insights FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.relatorios_alertas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, nome text NOT NULL, descricao text,
  valor numeric NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.relatorios_alertas_config (slug, nome, descricao, valor) VALUES
  ('queda_vendas_pct','Queda de vendas (%)','Queda mensal vs mês anterior',20),
  ('ocupacao_minima_pct','Ocupação mínima (%)','Ocupação mínima de horários',60),
  ('atraso_max_dias','Atraso máximo (dias)','Atraso máximo para alerta',7),
  ('avaliacao_atrasada_dias','Avaliação atrasada (dias)','Dias sem avaliação',30),
  ('treino_desatualizado_dias','Treino desatualizado (dias)','Dias desde último treino',60)
ON CONFLICT (slug) DO NOTHING;
ALTER TABLE public.relatorios_alertas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_alertas_config" ON public.relatorios_alertas_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_alertas_config" ON public.relatorios_alertas_config FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.pagamentos (venda_id, aluno_id, plano_id, valor_total, forma_pagamento, parcelas_qtd, status)
SELECT v.id, v.aluno_id, v.plano_id, COALESCE(v.valor_final, v.valor, 0), v.forma_pagamento, COALESCE(v.parcelas,1),
  CASE WHEN v.status_pagamento='pago' THEN 'quitado'
       WHEN v.status_pagamento='cancelado' THEN 'cancelado' ELSE 'em_dia' END
FROM public.vendas v
WHERE NOT EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.venda_id = v.id);

INSERT INTO public.pagamento_parcelas (pagamento_id, numero, valor, vencimento, data_pagamento, status, forma_pagamento)
SELECT p.id, 1, p.valor_total, v.data_venda,
  CASE WHEN v.status_pagamento='pago' THEN v.data_venda ELSE NULL END,
  CASE WHEN v.status_pagamento='pago' THEN 'pago'
       WHEN v.status_pagamento='cancelado' THEN 'cancelado' ELSE 'aberto' END,
  p.forma_pagamento
FROM public.pagamentos p JOIN public.vendas v ON v.id = p.venda_id
WHERE NOT EXISTS (SELECT 1 FROM public.pagamento_parcelas pp WHERE pp.pagamento_id = p.id);

CREATE OR REPLACE VIEW public.v_vendas_resumo WITH (security_invoker = on) AS
SELECT v.id AS venda_id, v.data_venda, date_trunc('month', v.data_venda)::date AS mes,
  v.aluno_id, a.nome AS aluno_nome, v.tipo, v.nome_snapshot AS item,
  v.valor, v.desconto, v.valor_final, v.status_pagamento, v.forma_pagamento, v.parcelas,
  v.vendedor_id, pr.full_name AS vendedor_nome,
  v.plano_id, pl.tipo AS plano_tipo, pl.duracao_meses, a.responsavel_id
FROM public.vendas v
LEFT JOIN public.alunos a ON a.id = v.aluno_id
LEFT JOIN public.profiles pr ON pr.user_id = v.vendedor_id
LEFT JOIN public.planos pl ON pl.id = v.plano_id;

CREATE OR REPLACE VIEW public.v_financeiro_recebimentos WITH (security_invoker = on) AS
SELECT pp.id AS parcela_id, pp.pagamento_id, pp.numero, pp.valor, pp.vencimento, pp.data_pagamento,
  pp.status, pp.forma_pagamento, pg.venda_id, pg.aluno_id, a.nome AS aluno_nome,
  date_trunc('month', pp.data_pagamento)::date AS mes_pagamento
FROM public.pagamento_parcelas pp
JOIN public.pagamentos pg ON pg.id = pp.pagamento_id
LEFT JOIN public.alunos a ON a.id = pg.aluno_id
WHERE pp.status = 'pago';

CREATE OR REPLACE VIEW public.v_financeiro_aberto WITH (security_invoker = on) AS
SELECT pp.id AS parcela_id, pp.pagamento_id, pp.numero, pp.valor, pp.vencimento, pp.status,
  pg.venda_id, pg.aluno_id, a.nome AS aluno_nome, a.telefone, a.responsavel_id,
  (CURRENT_DATE - pp.vencimento) AS dias_atraso
FROM public.pagamento_parcelas pp
JOIN public.pagamentos pg ON pg.id = pp.pagamento_id
LEFT JOIN public.alunos a ON a.id = pg.aluno_id
WHERE pp.status IN ('aberto','vencido');

CREATE OR REPLACE VIEW public.v_planos_base WITH (security_invoker = on) AS
SELECT pl.id AS plano_id, pl.aluno_id, a.nome AS aluno_nome, a.responsavel_id,
  pl.tipo, pl.data_inicio, pl.data_fim, pl.duracao_meses, pl.valor,
  pl.ativo, pl.renovacao_automatica, pl.proxima_renovacao,
  CASE WHEN pl.ativo AND (pl.data_fim IS NULL OR pl.data_fim >= CURRENT_DATE) THEN 'ativo'
       WHEN NOT pl.ativo THEN 'inativo' ELSE 'vencido' END AS situacao,
  (CURRENT_DATE - pl.data_inicio) AS dias_no_plano
FROM public.planos pl LEFT JOIN public.alunos a ON a.id = pl.aluno_id;

CREATE OR REPLACE VIEW public.v_cancelamentos WITH (security_invoker = on) AS
SELECT v.id AS venda_id, v.aluno_id, a.nome AS aluno_nome,
  v.data_venda, v.data_cancelamento,
  COALESCE(EXTRACT(EPOCH FROM (v.data_cancelamento - v.data_venda::timestamptz))/86400, 0)::integer AS dias_ate_cancelar,
  v.motivo_cancelamento_id, m.nome AS motivo_nome, m.slug AS motivo_slug,
  v.observacao_cancelamento, v.valor_final,
  v.vendedor_id, pr.full_name AS vendedor_nome, pl.tipo AS plano_tipo, a.responsavel_id
FROM public.vendas v
LEFT JOIN public.alunos a ON a.id = v.aluno_id
LEFT JOIN public.cancelamento_motivos m ON m.id = v.motivo_cancelamento_id
LEFT JOIN public.profiles pr ON pr.user_id = v.vendedor_id
LEFT JOIN public.planos pl ON pl.id = v.plano_id
WHERE v.status_pagamento = 'cancelado';

CREATE OR REPLACE VIEW public.v_servicos_agenda WITH (security_invoker = on) AS
SELECT ag.id AS agenda_id, ag.tipo, ag.atividade, ag.local,
  ag.dia_semana, ag.horario_inicio, ag.horario_fim, ag.data_especifica,
  ag.profissional_id, pr.full_name AS profissional_nome,
  ag.aluno_id, a.nome AS aluno_nome,
  EXISTS (SELECT 1 FROM public.consumo_servicos cs WHERE cs.agenda_id = ag.id) AS comparecimento
FROM public.agenda_servicos ag
LEFT JOIN public.profiles pr ON pr.user_id = ag.profissional_id
LEFT JOIN public.alunos a ON a.id = ag.aluno_id;

CREATE OR REPLACE VIEW public.v_crm_pipeline WITH (security_invoker = on) AS
SELECT pm.id AS movement_id, pm.aluno_id, a.nome AS aluno_nome, a.status AS aluno_status,
  pm.from_stage_id, fs.name AS from_stage,
  pm.to_stage_id, ts.name AS to_stage, ts.funnel,
  pm.moved_at, pm.time_in_previous_stage, pm.moved_by_user_id, a.responsavel_id
FROM public.pipeline_movements pm
LEFT JOIN public.alunos a ON a.id = pm.aluno_id
LEFT JOIN public.pipeline_stages fs ON fs.id = pm.from_stage_id
LEFT JOIN public.pipeline_stages ts ON ts.id = pm.to_stage_id;

CREATE OR REPLACE VIEW public.v_funil_conversao WITH (security_invoker = on) AS
SELECT date_trunc('month', a.created_at)::date AS mes, a.responsavel_id,
  count(*) AS total,
  count(*) FILTER (WHERE s.funnel='prospects') AS prospects,
  count(*) FILTER (WHERE s.funnel='aluno') AS alunos,
  count(*) FILTER (WHERE a.status='ativo') AS alunos_ativos,
  count(*) FILTER (WHERE a.status='perdido') AS perdidos,
  count(*) FILTER (WHERE a.status='inativo') AS inativos
FROM public.alunos a
LEFT JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id
GROUP BY 1,2;

CREATE OR REPLACE VIEW public.v_tecnico_alertas WITH (security_invoker = on) AS
WITH ua AS (SELECT aluno_id, max(data) AS data_ultima FROM public.avaliacoes GROUP BY aluno_id),
     ut AS (SELECT aluno_id, max(updated_at)::date AS data_ultimo FROM public.treinos GROUP BY aluno_id)
SELECT a.id AS aluno_id, a.nome, a.responsavel_id, a.frequencia_semanal,
  ua.data_ultima AS ultima_avaliacao, ut.data_ultimo AS ultimo_treino_atualizado,
  CASE WHEN ua.data_ultima IS NULL OR (CURRENT_DATE - ua.data_ultima) > 90 THEN true ELSE false END AS avaliacao_atrasada,
  CASE
    WHEN ut.data_ultimo IS NULL THEN true
    WHEN a.frequencia_semanal >= 3 AND (CURRENT_DATE - ut.data_ultimo) > 42 THEN true
    WHEN a.frequencia_semanal = 2 AND (CURRENT_DATE - ut.data_ultimo) > 56 THEN true
    WHEN a.frequencia_semanal <= 1 AND (CURRENT_DATE - ut.data_ultimo) > 84 THEN true
    ELSE false END AS treino_desatualizado
FROM public.alunos a
LEFT JOIN ua ON ua.aluno_id = a.id
LEFT JOIN ut ON ut.aluno_id = a.id
WHERE a.status='ativo';

CREATE OR REPLACE VIEW public.v_equipe_produtividade WITH (security_invoker = on) AS
SELECT pr.user_id AS profissional_id, pr.full_name AS nome,
  (SELECT count(*) FROM public.alunos al WHERE al.responsavel_id = pr.user_id AND al.status='ativo') AS alunos_ativos,
  (SELECT count(*) FROM public.avaliacoes av WHERE av.avaliador_id = pr.user_id AND av.data >= CURRENT_DATE - INTERVAL '30 days') AS avaliacoes_30d,
  (SELECT count(*) FROM public.agenda_servicos ag WHERE ag.profissional_id = pr.user_id) AS agendamentos,
  (SELECT count(*) FROM public.tarefas t WHERE t.responsavel_id = pr.user_id AND t.status::text='concluida' AND t.updated_at >= CURRENT_DATE - INTERVAL '30 days') AS tarefas_concluidas_30d,
  (SELECT count(*) FROM public.vendas v WHERE v.vendedor_id = pr.user_id AND v.status_pagamento='pago' AND v.data_venda >= CURRENT_DATE - INTERVAL '30 days') AS vendas_pagas_30d
FROM public.profiles pr
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = pr.user_id AND ur.role::text IN ('professor','coordenador','admin','nutricionista','fisioterapeuta'));
