-- 1. Views
ALTER VIEW public.v_cancelamentos SET (security_invoker = on);
ALTER VIEW public.v_vendas_resumo SET (security_invoker = on);
ALTER VIEW public.vw_contratos_vencendo SET (security_invoker = on);
ALTER VIEW public.vw_recebiveis_previstos_cartao_parcelado SET (security_invoker = on);
ALTER VIEW public.vw_recebiveis_previstos_futuros_cartao SET (security_invoker = on);
ALTER VIEW public.vw_recebiveis_previstos_mensalidades SET (security_invoker = on);
ALTER VIEW public.vw_recebiveis_previstos_produtos SET (security_invoker = on);
ALTER VIEW public.vw_recebiveis_previstos_servicos SET (security_invoker = on);
ALTER VIEW public.vw_recebiveis_previstos_todos SET (security_invoker = on);
REVOKE ALL ON public.v_cancelamentos, public.v_vendas_resumo, public.vw_contratos_vencendo,
  public.vw_recebiveis_previstos_cartao_parcelado, public.vw_recebiveis_previstos_futuros_cartao,
  public.vw_recebiveis_previstos_mensalidades, public.vw_recebiveis_previstos_produtos,
  public.vw_recebiveis_previstos_servicos, public.vw_recebiveis_previstos_todos,
  public.inadimplencias_view, public.v_crm_pipeline, public.v_equipe_produtividade,
  public.v_financeiro_aberto, public.v_financeiro_recebimentos, public.v_funil_conversao,
  public.v_planos_base, public.v_servicos_agenda, public.v_tecnico_alertas
  FROM anon, PUBLIC;
GRANT SELECT ON public.v_cancelamentos, public.v_vendas_resumo, public.vw_contratos_vencendo,
  public.vw_recebiveis_previstos_cartao_parcelado, public.vw_recebiveis_previstos_futuros_cartao,
  public.vw_recebiveis_previstos_mensalidades, public.vw_recebiveis_previstos_produtos,
  public.vw_recebiveis_previstos_servicos, public.vw_recebiveis_previstos_todos,
  public.inadimplencias_view, public.v_crm_pipeline, public.v_equipe_produtividade,
  public.v_financeiro_aberto, public.v_financeiro_recebimentos, public.v_funil_conversao,
  public.v_planos_base, public.v_servicos_agenda, public.v_tecnico_alertas
  TO authenticated, service_role;

-- 2. Funções críticas
CREATE OR REPLACE FUNCTION public.fn_desafio_atualizar_progresso(p_desafio_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _desafio clube_desafios%ROWTYPE;
  _progresso integer;
  _aluno RECORD;
  _alunos_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  SELECT * INTO _desafio FROM clube_desafios WHERE id = p_desafio_id AND status = 'ativo';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'desafio_nao_encontrado'); END IF;

  _progresso := fn_desafio_calcular_progresso(p_desafio_id);

  UPDATE clube_desafios SET
    progresso_atual = _progresso,
    updated_at = now()
  WHERE id = p_desafio_id;

  IF _progresso >= _desafio.valor_meta AND NOT _desafio.meta_atingida THEN
    UPDATE clube_desafios SET
      meta_atingida = true,
      meta_atingida_em = now(),
      updated_at = now()
    WHERE id = p_desafio_id;

    IF (_desafio.tipo_recompensa IN ('pontos', 'combinado')) AND
       (_desafio.pontos_recompensa > 0) AND
       NOT _desafio.recompensa_distribuida THEN

      FOR _aluno IN
        SELECT DISTINCT a.id as aluno_id
        FROM alunos a
        JOIN planos p ON p.aluno_id = a.id AND p.ativo = true
        WHERE a.status = 'ativo'
      LOOP
        PERFORM fn_clube_adicionar_pontos(
          _aluno.aluno_id,
          'ajuste_manual',
          p_desafio_id,
          'desafio_coletivo',
          'Recompensa: ' || _desafio.titulo,
          NULL,
          _desafio.pontos_recompensa
        );

        INSERT INTO clube_desafios_log (desafio_id, aluno_id, pontos_recebidos)
        VALUES (p_desafio_id, _aluno.aluno_id, _desafio.pontos_recompensa);

        _alunos_count := _alunos_count + 1;
      END LOOP;

      UPDATE clube_desafios SET
        recompensa_distribuida = true,
        recompensa_distribuida_em = now(),
        status = 'concluido',
        updated_at = now()
      WHERE id = p_desafio_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'progresso', _progresso,
    'meta', _desafio.valor_meta,
    'meta_atingida', (_progresso >= _desafio.valor_meta),
    'alunos_recompensados', _alunos_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_treino_concluir_sessao(p_aluno_id uuid, p_treino_id uuid, p_variacao text, p_agendamento_id uuid DEFAULT NULL::uuid, p_foi_troca boolean DEFAULT false, p_variacao_original text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sessao_id uuid;
  _aluno_id uuid;
BEGIN
  IF public.fn_current_aluno_id() IS NOT NULL THEN
    IF p_aluno_id IS NOT NULL AND p_aluno_id <> public.fn_current_aluno_id() THEN
      RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
    END IF;
    _aluno_id := public.fn_current_aluno_id();
  ELSIF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN
    _aluno_id := p_aluno_id;
  ELSE
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.treino_sessoes (
    aluno_id, treino_id, variacao, variacao_original,
    foi_troca, agendamento_id, data, concluido_em, observacoes
  ) VALUES (
    _aluno_id, p_treino_id, p_variacao, p_variacao_original,
    p_foi_troca, p_agendamento_id, CURRENT_DATE, now(), p_observacoes
  ) RETURNING id INTO _sessao_id;

  IF p_agendamento_id IS NOT NULL THEN
    UPDATE public.treino_agendamentos SET
      status = 'realizado',
      updated_at = now()
    WHERE id = p_agendamento_id
      AND status IN ('agendado', 'confirmado');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sessao_id', _sessao_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_listar_profissionais()
 RETURNS TABLE(user_id uuid, full_name text, role app_role)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (p.user_id) p.user_id, p.full_name, ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE public.is_staff(auth.uid())
    AND ur.role IN ('professor','nutricionista','fisioterapeuta','coordenador','admin')
  ORDER BY p.user_id, ur.role;
$function$;

CREATE OR REPLACE FUNCTION public.fn_clube_ajuste_manual_pontos(p_aluno_id uuid, p_motivo_manual text, p_pontos_manual integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF nullif(btrim(coalesce(p_motivo_manual, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'motivo_obrigatorio');
  END IF;
  RETURN public.fn_clube_adicionar_pontos(p_aluno_id, 'ajuste_manual', NULL, NULL, p_motivo_manual, auth.uid(), p_pontos_manual);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_clube_ajuste_manual_pontos(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clube_ajuste_manual_pontos(uuid, text, integer) TO authenticated, service_role;

-- 3. rede_tokenizacoes
DROP POLICY IF EXISTS staff_all_rede_tokenizacoes ON public.rede_tokenizacoes;
CREATE POLICY coord_admin_select_rede_tokenizacoes ON public.rede_tokenizacoes
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));
REVOKE ALL ON public.rede_tokenizacoes FROM anon, PUBLIC, authenticated;
GRANT SELECT ON public.rede_tokenizacoes TO authenticated;
GRANT ALL ON public.rede_tokenizacoes TO service_role;

-- 4. Endurecimento geral
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

DO $harden$
DECLARE
  _f record;
  -- Abertas ao anon: páginas públicas e helpers de policy que só respondem sobre o próprio chamador.
  _anon_keep text[] := ARRAY[
    'fn_parceiro_login','fn_validar_link_cartao','fn_validar_link_contrato','fn_planos_publico_2027',
    'fn_proposta_plano_2027_criar','fn_site_fotos_publico','fn_site_foto_publicada',
    'fn_festa_total_confirmados','fn_festa_fotos_interacoes','fn_loja_estoque_disponivel',
    'is_staff','is_admin_role','is_professor_staff','is_staff_or_aluno','has_role','is_admin',
    'is_coordinator_or_admin','fn_current_aluno_id'];
  -- Só service_role / chamadas internas.
  _service_only text[] := ARRAY[
    'fn_clube_adicionar_pontos','fn_agenda_estornar_credito_por_agenda','fn_clube_conceder_badge',
    'fn_auditoria_fiscal_pagamentos','fn_auditoria_fiscal_creditos','fn_auditoria_fiscal_pipeline',
    'fn_gerar_tarefas_relatorio_tecnico','fn_plano_principal_ativo','fn_inserir_inscricao_prova'];
BEGIN
  FOR _f IN
    SELECT p.oid, p.proname, p.prorettype, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
       AND p.proname NOT LIKE 'pgaudit%'
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    CONTINUE WHEN _f.proname = ANY(_anon_keep);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', _f.proname, _f.args);
    IF _f.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype)
       OR _f.proname = ANY(_service_only)
       OR (_f.proname = 'fn_agendar_servico' AND _f.args LIKE '%_servico_catalogo_id%') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', _f.proname, _f.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', _f.proname, _f.args);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', _f.proname, _f.args);
    END IF;
  END LOOP;
END
$harden$;