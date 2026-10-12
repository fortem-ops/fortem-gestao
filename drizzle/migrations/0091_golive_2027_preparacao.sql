-- Fase 4G (preparação): backup, snapshot, reversão e ativação (não executada).
CREATE TABLE public._golive_2027_backup (
  id bigserial PRIMARY KEY,
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  ativo boolean,
  vendavel_desde date,
  vendavel_ate date,
  conteudo text,
  capturado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tabela, registro_id)
);
GRANT SELECT ON public._golive_2027_backup TO authenticated;
GRANT ALL ON public._golive_2027_backup TO service_role;
ALTER TABLE public._golive_2027_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY golive_backup_admin_select ON public._golive_2027_backup
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public._golive_2027_contagens (
  id bigserial PRIMARY KEY,
  rotulo text NOT NULL,
  metrica text NOT NULL,
  valor text,
  capturado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public._golive_2027_contagens TO authenticated;
GRANT ALL ON public._golive_2027_contagens TO service_role;
ALTER TABLE public._golive_2027_contagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY golive_contagens_admin_select ON public._golive_2027_contagens
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Backup do estado atual (antes de qualquer alteração).
INSERT INTO public._golive_2027_backup(tabela, registro_id, ativo, vendavel_desde, vendavel_ate)
SELECT 'planos_catalogo', id, ativo, vendavel_desde, vendavel_ate FROM public.planos_catalogo;
INSERT INTO public._golive_2027_backup(tabela, registro_id, ativo, vendavel_desde, vendavel_ate)
SELECT 'servicos_catalogo', id, ativo, vendavel_desde, vendavel_ate FROM public.servicos_catalogo;
INSERT INTO public._golive_2027_backup(tabela, registro_id, ativo, conteudo)
SELECT 'contrato_templates', id, ativo, conteudo FROM public.contrato_templates WHERE plano_tipo IN ('start_2027','power_2027','pro_2027');

-- Snapshot de contagens (admin ou execução interna sem usuário).
CREATE OR REPLACE FUNCTION public.fn_golive_2027_snapshot(p_rotulo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente administradores'; END IF;
  INSERT INTO public._golive_2027_contagens(rotulo, metrica, valor)
  SELECT p_rotulo, 'planos_alunos_ativo_' || coalesce(ativo::text,'null'), count(*)::text FROM public.planos GROUP BY ativo
  UNION ALL SELECT p_rotulo, 'contratos_status_' || coalesce(status::text,'null'), count(*)::text FROM public.contratos GROUP BY status
  UNION ALL SELECT p_rotulo, 'cobrancas_pendentes_qtd', count(*)::text FROM public.cobrancas WHERE status = 'pendente'
  UNION ALL SELECT p_rotulo, 'cobrancas_pendentes_soma', coalesce(sum(valor),0)::text FROM public.cobrancas WHERE status = 'pendente'
  UNION ALL SELECT p_rotulo, 'creditos_ativos', count(*)::text FROM public.creditos_aluno WHERE ativo
  UNION ALL SELECT p_rotulo, 'catalogo_ativos_2027', count(*)::text FROM public.planos_catalogo WHERE versao IS NOT NULL AND ativo
  UNION ALL SELECT p_rotulo, 'catalogo_legado_treino_ativos', count(*)::text FROM public.planos_catalogo WHERE versao IS NULL AND atividade <> 'corrida' AND ativo
  UNION ALL SELECT p_rotulo, 'catalogo_legado_corrida_ativos', count(*)::text FROM public.planos_catalogo WHERE versao IS NULL AND atividade = 'corrida' AND ativo
  UNION ALL SELECT p_rotulo, 'catalogo_legado_com_vendavel_ate', count(*)::text FROM public.planos_catalogo WHERE versao IS NULL AND vendavel_ate IS NOT NULL
  UNION ALL SELECT p_rotulo, 'servicos_ativos_2027', count(*)::text FROM public.servicos_catalogo WHERE versao IS NOT NULL AND ativo
  UNION ALL SELECT p_rotulo, 'templates_ativos_2027', count(*)::text FROM public.contrato_templates WHERE plano_tipo IN ('start_2027','power_2027','pro_2027') AND ativo
  UNION ALL SELECT p_rotulo, 'cron_' || jobname, active::text FROM cron.job;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fn_golive_2027_snapshot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_golive_2027_snapshot(text) TO authenticated, service_role;

-- Reversão: restaura ativo/vendavel_* a partir do backup.
CREATE OR REPLACE FUNCTION public.fn_golive_2027_reverter()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a int; b int; c int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente administradores'; END IF;
  UPDATE public.planos_catalogo t SET ativo = bk.ativo, vendavel_desde = bk.vendavel_desde, vendavel_ate = bk.vendavel_ate
    FROM public._golive_2027_backup bk WHERE bk.tabela = 'planos_catalogo' AND bk.registro_id = t.id
      AND (t.ativo IS DISTINCT FROM bk.ativo OR t.vendavel_desde IS DISTINCT FROM bk.vendavel_desde OR t.vendavel_ate IS DISTINCT FROM bk.vendavel_ate);
  GET DIAGNOSTICS a = ROW_COUNT;
  UPDATE public.servicos_catalogo t SET ativo = bk.ativo, vendavel_desde = bk.vendavel_desde, vendavel_ate = bk.vendavel_ate
    FROM public._golive_2027_backup bk WHERE bk.tabela = 'servicos_catalogo' AND bk.registro_id = t.id
      AND (t.ativo IS DISTINCT FROM bk.ativo OR t.vendavel_desde IS DISTINCT FROM bk.vendavel_desde OR t.vendavel_ate IS DISTINCT FROM bk.vendavel_ate);
  GET DIAGNOSTICS b = ROW_COUNT;
  -- Templates: volta só o "ativo" (o texto sem Pix Automático é mantido; o original fica no backup).
  UPDATE public.contrato_templates t SET ativo = bk.ativo
    FROM public._golive_2027_backup bk WHERE bk.tabela = 'contrato_templates' AND bk.registro_id = t.id AND t.ativo IS DISTINCT FROM bk.ativo;
  GET DIAGNOSTICS c = ROW_COUNT;
  INSERT INTO public.system_logs(modulo, acao, mensagem, payload, user_id)
  VALUES ('golive_2027', 'reverter', 'Reversão do go-live 2027', jsonb_build_object('planos', a, 'servicos', b, 'templates', c), auth.uid());
  RETURN jsonb_build_object('planos', a, 'servicos', b, 'templates', c);
END $$;
REVOKE ALL ON FUNCTION public.fn_golive_2027_reverter() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_golive_2027_reverter() TO authenticated, service_role;

-- Ativação (NÃO executada agora): só itens 2027; legado intocado.
CREATE OR REPLACE FUNCTION public.fn_golive_2027_ativar(p_data_inicio date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a int; b int; c int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente administradores'; END IF;
  IF p_data_inicio IS NULL THEN RAISE EXCEPTION 'Informe a data de início'; END IF;
  IF EXISTS (SELECT 1 FROM public.contrato_templates WHERE plano_tipo IN ('start_2027','power_2027','pro_2027')
             AND (conteudo ILIKE '%pix autom%' OR conteudo ILIKE '%boleto%')) THEN
    RAISE EXCEPTION 'Templates 2027 ainda citam Pix Automático ou boleto';
  END IF;
  UPDATE public.planos_catalogo SET ativo = true, vendavel_desde = p_data_inicio, vendavel_ate = NULL
    WHERE versao IS NOT NULL AND familia IN ('start_2027','power_2027','pro_2027');
  GET DIAGNOSTICS a = ROW_COUNT;
  UPDATE public.servicos_catalogo SET ativo = true, vendavel_desde = p_data_inicio, vendavel_ate = NULL
    WHERE versao IS NOT NULL AND codigo LIKE '%\_2027' ESCAPE '\';
  GET DIAGNOSTICS b = ROW_COUNT;
  UPDATE public.contrato_templates SET ativo = true WHERE plano_tipo IN ('start_2027','power_2027','pro_2027') AND versao = 1;
  GET DIAGNOSTICS c = ROW_COUNT;
  INSERT INTO public.system_logs(modulo, acao, mensagem, payload, user_id)
  VALUES ('golive_2027', 'ativar', 'Ativação do go-live 2027', jsonb_build_object('data_inicio', p_data_inicio, 'planos', a, 'servicos', b, 'templates', c), auth.uid());
  RETURN jsonb_build_object('planos', a, 'servicos', b, 'templates', c, 'data_inicio', p_data_inicio);
END $$;
REVOKE ALL ON FUNCTION public.fn_golive_2027_ativar(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_golive_2027_ativar(date) TO authenticated, service_role;

-- Venda 2027: liberar para coordenador e professor (consultores), além de admin. Só a checagem de permissão muda.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.fn_venda_2027_criar(jsonb)'::regprocedure);
  IF position('IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN' IN d) = 0 THEN
    RAISE EXCEPTION 'Checagem de permissão não encontrada em fn_venda_2027_criar';
  END IF;
  d := replace(d, 'IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN',
    'IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, ''coordenador''::app_role) OR public.has_role(v_uid, ''professor''::app_role)) THEN');
  d := replace(d, 'Somente administradores podem vender planos 2027', 'Sem permissão para vender planos 2027');
  EXECUTE d;
END
$do$;