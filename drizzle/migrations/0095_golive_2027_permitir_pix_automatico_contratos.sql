CREATE OR REPLACE FUNCTION public.fn_golive_2027_ativar(p_data_inicio date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE a int; b int; c int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente administradores'; END IF;
  IF p_data_inicio IS NULL THEN RAISE EXCEPTION 'Informe a data de início'; END IF;
  IF EXISTS (SELECT 1 FROM public.contrato_templates WHERE plano_tipo IN ('start_2027','power_2027','pro_2027')
             AND conteudo ILIKE '%boleto%') THEN
    RAISE EXCEPTION 'Templates 2027 ainda citam boleto';
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
END $function$;
REVOKE ALL ON FUNCTION public.fn_golive_2027_ativar(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_golive_2027_ativar(date) TO authenticated, service_role;