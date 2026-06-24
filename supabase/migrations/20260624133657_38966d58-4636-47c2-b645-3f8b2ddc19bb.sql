-- ============================================================
-- MÓDULO FINANCEIRO — PARTE 1
-- Fortem Gestão · 2026-06-24
-- ============================================================

-- 1. contratos
CREATE TABLE public.contratos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id                uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  plano_id                uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  plano_tipo              text NOT NULL
    CHECK (plano_tipo IN ('start','start_plus','power','pro','max','corrida','gympass','wellhub','totalpass','outro')),
  frequencia_semanal      smallint NOT NULL CHECK (frequencia_semanal IN (0,1,2,3)),
  creditos_total          integer NOT NULL CHECK (creditos_total >= 0),
  vigencia_tipo           text NOT NULL CHECK (vigencia_tipo IN ('mensal','anual')),
  data_inicio             date NOT NULL,
  data_fim                date,
  data_renovacao          date,
  forma_pagamento         text NOT NULL
    CHECK (forma_pagamento IN (
      'cartao_recorrencia','cartao_parcelado','pix_automatico',
      'boleto','maquina_debito','maquina_credito','dinheiro'
    )),
  valor_base              numeric(10,2) NOT NULL CHECK (valor_base >= 0),
  valor_cobrado           numeric(10,2) NOT NULL CHECK (valor_cobrado >= 0),
  taxa_recorrencia        numeric(10,2) NOT NULL DEFAULT 0 CHECK (taxa_recorrencia >= 0),
  parcelas                smallint NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 12),
  status                  text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','suspenso','cancelado','inadimplente','encerrado')),
  indice_reajuste         text CHECK (indice_reajuste IN ('igpm','ipca','fixo',NULL)),
  percentual_reajuste     numeric(5,2),
  multa_percentual        numeric(5,2),
  cartao_token_id         uuid REFERENCES public.cartoes_salvos(id) ON DELETE SET NULL,
  notificacao_30d_enviada boolean NOT NULL DEFAULT false,
  motivo_cancelamento     text,
  data_cancelamento       date,
  criado_por              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contratos IS
  'Vínculo jurídico entre aluno e Fortem. Centraliza plano, vigência, pagamento e rescisão. '
  'Coexiste com planos (legado) durante migração gradual. Criado em 2026-06-24.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;

CREATE INDEX contratos_aluno_idx     ON public.contratos(aluno_id);
CREATE INDEX contratos_status_idx    ON public.contratos(status);
CREATE INDEX contratos_renovacao_idx ON public.contratos(data_renovacao) WHERE status = 'ativo';
CREATE INDEX contratos_data_fim_idx  ON public.contratos(data_fim) WHERE data_fim IS NOT NULL;

DROP TRIGGER IF EXISTS trg_contratos_updated_at ON public.contratos;
CREATE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_admin_all"   ON public.contratos FOR ALL    USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "contratos_coord_select" ON public.contratos FOR SELECT USING (public.is_coordenador_ou_admin());
CREATE POLICY "contratos_coord_insert" ON public.contratos FOR INSERT WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "contratos_coord_update" ON public.contratos FOR UPDATE USING (public.is_coordenador_ou_admin());
CREATE POLICY "contratos_self_select"  ON public.contratos FOR SELECT USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_audit_contratos ON public.contratos;
CREATE TRIGGER trg_audit_contratos
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- ============================================================
-- 2. cobrancas
-- ============================================================
CREATE TABLE public.cobrancas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id      uuid NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
  aluno_id         uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  numero_ciclo     smallint NOT NULL CHECK (numero_ciclo >= 1),
  valor            numeric(10,2) NOT NULL CHECK (valor >= 0),
  data_vencimento  date NOT NULL,
  data_pagamento   date,
  status           text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','pago','atrasado','cancelado','isento')),
  forma_pagamento  text NOT NULL,
  meio_registro    text NOT NULL DEFAULT 'automatico'
    CHECK (meio_registro IN ('automatico','manual_admin','gateway_webhook')),
  gateway          text
    CHECK (gateway IN ('rede','inter_pix','boleto','maquina','dinheiro',NULL)),
  tid              text,
  comprovante_url  text,
  registrado_por   uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero_ciclo)
);

COMMENT ON TABLE public.cobrancas IS
  'Eventos financeiros de cada contrato. 1 linha por ciclo de cobrança.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;

CREATE INDEX cobrancas_contrato_idx   ON public.cobrancas(contrato_id);
CREATE INDEX cobrancas_aluno_idx      ON public.cobrancas(aluno_id);
CREATE INDEX cobrancas_vencimento_idx ON public.cobrancas(data_vencimento) WHERE status = 'pendente';
CREATE INDEX cobrancas_status_idx     ON public.cobrancas(status);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_admin_all"   ON public.cobrancas FOR ALL    USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "cobrancas_coord_select" ON public.cobrancas FOR SELECT USING (public.is_coordenador_ou_admin());
CREATE POLICY "cobrancas_coord_insert" ON public.cobrancas FOR INSERT WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "cobrancas_coord_update" ON public.cobrancas FOR UPDATE USING (public.is_coordenador_ou_admin());
CREATE POLICY "cobrancas_self_select"  ON public.cobrancas FOR SELECT USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_audit_cobrancas ON public.cobrancas;
CREATE TRIGGER trg_audit_cobrancas
  AFTER INSERT OR UPDATE OR DELETE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- ============================================================
-- 3. ciclos_credito
-- ============================================================
CREATE TABLE public.ciclos_credito (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         uuid NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
  cobranca_id         uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  creditos_liberados  integer NOT NULL CHECK (creditos_liberados >= 0),
  creditos_usados     integer NOT NULL DEFAULT 0 CHECK (creditos_usados >= 0),
  data_inicio         date NOT NULL,
  data_fim            date,
  status              text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','suspenso','expirado','cancelado')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (creditos_usados <= creditos_liberados)
);

COMMENT ON TABLE public.ciclos_credito IS
  'Ciclos de crédito de treino vinculados a contratos. Start: expira. Anuais: liberados na assinatura.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ciclos_credito TO authenticated;
GRANT ALL ON public.ciclos_credito TO service_role;

CREATE INDEX ciclos_contrato_idx ON public.ciclos_credito(contrato_id);
CREATE INDEX ciclos_status_idx   ON public.ciclos_credito(status) WHERE status = 'ativo';

ALTER TABLE public.ciclos_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciclos_admin_all"   ON public.ciclos_credito FOR ALL USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "ciclos_coord_all"   ON public.ciclos_credito FOR ALL USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ciclos_staff_select" ON public.ciclos_credito FOR SELECT USING (public.is_professor_staff());
CREATE POLICY "ciclos_self_select"  ON public.ciclos_credito FOR SELECT
  USING (contrato_id IN (
    SELECT id FROM public.contratos
    WHERE aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid())
  ));

-- ============================================================
-- 4. inadimplencias
-- ============================================================
CREATE TABLE public.inadimplencias (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id          uuid NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
  cobranca_id          uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  aluno_id             uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  data_vencimento      date NOT NULL,
  valor                numeric(10,2) NOT NULL CHECK (valor > 0),
  -- dias_atraso é calculado on-read pela view inadimplencias_view (CURRENT_DATE não é immutable)
  status               text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','regularizada','cancelada')),
  data_regularizacao   date,
  notificacoes         jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inadimplencias IS
  'Registro formal de inadimplência. Régua: D+0 notifica aluno, D+3 alerta admin, D+7 suspende, D+30 cancela.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inadimplencias TO authenticated;
GRANT ALL ON public.inadimplencias TO service_role;

CREATE INDEX inadimp_contrato_idx   ON public.inadimplencias(contrato_id);
CREATE INDEX inadimp_aluno_idx      ON public.inadimplencias(aluno_id);
CREATE INDEX inadimp_status_idx     ON public.inadimplencias(status) WHERE status = 'aberta';
CREATE INDEX inadimp_vencimento_idx ON public.inadimplencias(data_vencimento);

ALTER TABLE public.inadimplencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inadimp_admin_all"    ON public.inadimplencias FOR ALL USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "inadimp_coord_select" ON public.inadimplencias FOR SELECT USING (public.is_coordenador_ou_admin());
CREATE POLICY "inadimp_coord_insert" ON public.inadimplencias FOR INSERT WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "inadimp_self_select"  ON public.inadimplencias FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_audit_inadimplencias ON public.inadimplencias;
CREATE TRIGGER trg_audit_inadimplencias
  AFTER INSERT OR UPDATE OR DELETE ON public.inadimplencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- View com dias_atraso calculado on-read
CREATE OR REPLACE VIEW public.inadimplencias_view AS
SELECT i.*, (CURRENT_DATE - i.data_vencimento) AS dias_atraso
FROM public.inadimplencias i;

GRANT SELECT ON public.inadimplencias_view TO authenticated;
GRANT ALL ON public.inadimplencias_view TO service_role;

-- ============================================================
-- 5. consumo_servicos.contrato_id
-- ============================================================
ALTER TABLE public.consumo_servicos
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS consumo_contrato_idx
  ON public.consumo_servicos(contrato_id) WHERE contrato_id IS NOT NULL;

-- ============================================================
-- 6. fn_calcular_rescisao
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_calcular_rescisao(p_contrato_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v              public.contratos%ROWTYPE;
  v_mes_atual    int;
  v_meses_rest   int;
  v_perc_multa   numeric;
  v_perc_restit  numeric;
  v_vincendo     numeric;
  v_multa        numeric;
  v_restit_bruto numeric;
  v_servicos     numeric := 0;
BEGIN
  IF NOT (public.is_admin_role() OR public.is_coordenador_ou_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  IF v.vigencia_tipo = 'mensal' THEN
    RETURN jsonb_build_object(
      'tipo','start_sem_multa','plano_tipo',v.plano_tipo,
      'data_inicio',v.data_inicio,'total_devido',0,'total_restituir',0,
      'descricao','Plano mensal sem fidelidade. Sem multa de cancelamento. '
               || 'Acesso mantido até o fim do ciclo já pago. '
               || 'Cobranças futuras interrompidas imediatamente.'
    );
  END IF;

  v_mes_atual := GREATEST(1, LEAST(12,
    EXTRACT(YEAR  FROM age(CURRENT_DATE, v.data_inicio))::int * 12 +
    EXTRACT(MONTH FROM age(CURRENT_DATE, v.data_inicio))::int + 1
  ));
  v_meses_rest := 12 - v_mes_atual;

  v_perc_multa  := CASE WHEN v_mes_atual <= 4 THEN 0.25 WHEN v_mes_atual <= 6 THEN 0.20 ELSE 0.15 END;
  v_perc_restit := CASE WHEN v_mes_atual <= 4 THEN 0.75 WHEN v_mes_atual <= 6 THEN 0.80 ELSE 0.85 END;

  SELECT COALESCE(SUM(
    CASE tipo_servico
      WHEN 'nutricao'     THEN 300.00
      WHEN 'fisioterapia' THEN 150.00
      ELSE 0
    END), 0) INTO v_servicos
  FROM public.consumo_servicos
  WHERE contrato_id = p_contrato_id
    AND (utilizado = true OR status = 'realizado');

  IF v.forma_pagamento = 'cartao_recorrencia' OR v.forma_pagamento = 'pix_automatico' THEN
    v_vincendo := GREATEST(0, v_meses_rest) * v.valor_cobrado;
    v_multa    := ROUND(v_vincendo * v_perc_multa
                + (v_servicos / 12.0) * GREATEST(0, v_meses_rest), 2);

    RETURN jsonb_build_object(
      'tipo','recorrencia_com_multa','plano_tipo',v.plano_tipo,
      'data_inicio',v.data_inicio,'data_fim',v.data_fim,
      'mes_atual',v_mes_atual,'meses_restantes',v_meses_rest,
      'valor_mensalidade',v.valor_cobrado,'taxa_recorrencia',v.taxa_recorrencia,
      'valor_vincendo',ROUND(v_vincendo,2),
      'percentual_multa',(v_perc_multa*100)::int,
      'multa_base',ROUND(v_vincendo * v_perc_multa,2),
      'servicos_utilizados',ROUND(v_servicos,2),
      'servicos_vincendos',ROUND((v_servicos/12.0)*GREATEST(0,v_meses_rest),2),
      'total_devido',v_multa,'total_restituir',0,
      'descricao',format(
        'Rescisão no %sº mês. Multa de %s%% sobre %s mensalidades vincendas (R$ %s). '
        || 'Serviços parcelados vincendos: R$ %s. Total: R$ %s.',
        v_mes_atual,(v_perc_multa*100)::int,v_meses_rest,
        ROUND(v_vincendo,2),
        ROUND((v_servicos/12.0)*GREATEST(0,v_meses_rest),2),v_multa)
    );
  END IF;

  v_restit_bruto := ROUND(((v_meses_rest::numeric/12.0) * v.valor_cobrado * v.parcelas) * v_perc_restit, 2);

  RETURN jsonb_build_object(
    'tipo','parcelado_com_restituicao','plano_tipo',v.plano_tipo,
    'data_inicio',v.data_inicio,'data_fim',v.data_fim,
    'mes_atual',v_mes_atual,'meses_restantes',v_meses_rest,
    'valor_total_contrato',ROUND(v.valor_cobrado * v.parcelas,2),
    'valor_proporcional',ROUND((v_meses_rest::numeric/12.0) * v.valor_cobrado * v.parcelas,2),
    'percentual_restituicao',(v_perc_restit*100)::int,
    'restituicao_bruta',v_restit_bruto,
    'deducao_servicos',ROUND(v_servicos,2),
    'total_restituir',ROUND(GREATEST(v_restit_bruto - v_servicos,0),2),
    'saldo_devedor',ROUND(GREATEST(v_servicos - v_restit_bruto,0),2),
    'total_devido',ROUND(GREATEST(v_servicos - v_restit_bruto,0),2),
    'descricao',format(
      'Rescisão no %sº mês. Restituição de %s%% do proporcional restante (R$ %s). '
      || 'Dedução serviços utilizados: R$ %s. '
      || CASE WHEN v_restit_bruto >= v_servicos
         THEN 'Valor a restituir ao aluno: R$ %s.'
         ELSE 'Saldo devedor do aluno: R$ %s.' END,
      v_mes_atual,(v_perc_restit*100)::int,v_restit_bruto,
      ROUND(v_servicos,2),ROUND(ABS(v_restit_bruto - v_servicos),2))
  );
END; $fn$;

COMMENT ON FUNCTION public.fn_calcular_rescisao IS
  'Calcula rescisão. Start: sem multa. Recorrência: multa vincendas (25/20/15%). '
  'Parcelado: restituição proporcional (75/80/85%) menos serviços utilizados.';

-- ============================================================
-- 7. pg_cron: régua diária 07:00
-- ============================================================
SELECT cron.schedule(
  'processar-cobrancas-diario',
  '0 7 * * *',
  $cron$
  WITH vencidas AS (
    UPDATE public.cobrancas
    SET status = 'atrasado'
    WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE
    RETURNING id, contrato_id, aluno_id, data_vencimento, valor
  )
  INSERT INTO public.inadimplencias (contrato_id, cobranca_id, aluno_id, data_vencimento, valor)
  SELECT v.contrato_id, v.id, v.aluno_id, v.data_vencimento, v.valor
  FROM vencidas v
  WHERE NOT EXISTS (SELECT 1 FROM public.inadimplencias i WHERE i.cobranca_id = v.id);

  UPDATE public.contratos SET status = 'suspenso'
  WHERE status = 'ativo'
    AND id IN (
      SELECT DISTINCT contrato_id FROM public.inadimplencias
      WHERE status = 'aberta' AND (CURRENT_DATE - data_vencimento) >= 7
    );

  UPDATE public.ciclos_credito SET status = 'suspenso'
  WHERE status = 'ativo'
    AND contrato_id IN (SELECT id FROM public.contratos WHERE status = 'suspenso');

  UPDATE public.contratos SET status = 'cancelado', data_cancelamento = CURRENT_DATE,
    motivo_cancelamento = 'Cancelamento automático por inadimplência (D+30)'
  WHERE status = 'suspenso'
    AND id IN (
      SELECT DISTINCT contrato_id FROM public.inadimplencias
      WHERE status = 'aberta' AND (CURRENT_DATE - data_vencimento) >= 30
    );

  UPDATE public.contratos SET notificacao_30d_enviada = true
  WHERE vigencia_tipo = 'anual'
    AND notificacao_30d_enviada = false
    AND data_fim IS NOT NULL
    AND data_fim - CURRENT_DATE <= 30
    AND status = 'ativo';
  $cron$
);