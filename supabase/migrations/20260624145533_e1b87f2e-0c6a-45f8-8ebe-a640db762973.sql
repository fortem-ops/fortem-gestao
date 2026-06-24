DO $$
DECLARE
  needed text[] := ARRAY[
    'fn_current_aluno_id',
    'fn_user_can_see_notificacao',
    'fn_clube_dashboard',
    'fn_clube_generate_qr_token',
    'fn_clube_marcar_alerta_lido',
    'fn_clube_resync_todos_safe',
    'fn_clube_validar_token',
    'fn_convert_lead_to_prospect',
    'fn_detect_evasao',
    'fn_move_pipeline',
    'fn_notificar_criar_notificacao',
    'fn_notificar_expandir_destinatarios',
    'fn_notificar_listar_profissionais',
    'fn_notificar_agenda_evento',
    'fn_ponto_ajustar_jornada',
    'fn_ponto_aprovar_fechamento',
    'fn_ponto_banco_resumo',
    'fn_ponto_banco_saldo',
    'fn_ponto_dashboard_coordenador',
    'fn_ponto_dashboard_periodo',
    'fn_ponto_estado_atual',
    'fn_ponto_gerar_fechamentos_mes',
    'fn_ponto_janelas_dia',
    'fn_ponto_registrar',
    'fn_portal_link_aluno',
    'get_dashboard_data',
    'rename_exercicio_categoria',
    'fn_carteira_ativos_por_profissional',
    'fn_carteira_total_ativos',
    'fn_calcular_rescisao'
  ];
  sig text;
BEGIN
  FOR sig IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(needed)
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip %: %', sig, SQLERRM;
    END;
  END LOOP;

  -- fn_current_aluno_id também precisa estar acessível ao anon
  -- porque é avaliada por algumas RLS em rotas públicas.
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_current_aluno_id() TO anon';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;