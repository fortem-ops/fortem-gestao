CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_estado(p_proposta uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('pix_automatico', pr.pix_automatico, 'estado', pr.pix_aut_estado,
    'codigos_restantes', 3 - pr.pix_aut_codigos, 'liberado', fn_pix_automatico_2027_liberado(pr.id),
    'id_rec', r.id_rec, 'status_rec', r.status, 'expira_em', r.codigo_expira_em, 'primeiro_debito', r.data_inicio)
  FROM propostas_planos_2027 pr
  LEFT JOIN LATERAL (SELECT * FROM pix_recorrencias x WHERE x.proposta_id = pr.id ORDER BY x.codigo_numero DESC NULLS LAST, x.created_at DESC LIMIT 1) r ON true
  WHERE pr.id = p_proposta
$$;
REVOKE ALL ON FUNCTION public.fn_pix_automatico_2027_estado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_automatico_2027_estado(uuid) TO service_role;