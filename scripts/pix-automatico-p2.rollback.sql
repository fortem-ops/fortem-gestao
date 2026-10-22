-- Aplicada como migração 0190_pix_automatico_p2a em 22/10/2026.
-- Volta da P2a do Pix Automático. Só funciona enquanto não houver recorrência com origem 'site_2027'
-- nem proposta com pix_automatico = true (confira antes; se houver, pare e fale com o dono).
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_estado(uuid);
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_aviso(text, text);
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_falhou(uuid, boolean);
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_registrar(uuid, text, numeric, date, timestamptz, jsonb);
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_reservar(uuid);
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_marcar(uuid);
DROP FUNCTION IF EXISTS public.fn_pix_automatico_2027_liberado(uuid);
ALTER TABLE public.propostas_planos_2027
  DROP CONSTRAINT IF EXISTS propostas_pix_aut_forma_chk,
  DROP CONSTRAINT IF EXISTS propostas_pix_aut_estado_chk,
  DROP CONSTRAINT IF EXISTS propostas_pix_aut_codigos_chk,
  DROP COLUMN IF EXISTS notificacao_pix_aut_id,
  DROP COLUMN IF EXISTS pix_aut_atualizado_em,
  DROP COLUMN IF EXISTS pix_aut_estado,
  DROP COLUMN IF EXISTS pix_aut_codigos,
  DROP COLUMN IF EXISTS pix_automatico;
DROP INDEX IF EXISTS public.pix_recorrencias_proposta_viva_uidx;
ALTER TABLE public.pix_recorrencias
  DROP CONSTRAINT IF EXISTS pix_recorrencias_site_proposta_chk,
  DROP CONSTRAINT IF EXISTS pix_recorrencias_codigo_numero_chk,
  DROP CONSTRAINT IF EXISTS pix_recorrencias_origem_chk,
  DROP COLUMN IF EXISTS codigo_expira_em,
  DROP COLUMN IF EXISTS codigo_numero,
  DROP COLUMN IF EXISTS origem,
  DROP COLUMN IF EXISTS venda_id,
  DROP COLUMN IF EXISTS contrato_id,
  DROP COLUMN IF EXISTS proposta_id;

-- Volta só do desempate (migração 0191): restaura a versão da 0190 de fn_pix_automatico_2027_estado.
-- CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_estado(p_proposta uuid)
-- RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT jsonb_build_object('pix_automatico', pr.pix_automatico, 'estado', pr.pix_aut_estado,
--     'codigos_restantes', 3 - pr.pix_aut_codigos, 'liberado', fn_pix_automatico_2027_liberado(pr.id),
--     'id_rec', r.id_rec, 'status_rec', r.status, 'expira_em', r.codigo_expira_em, 'primeiro_debito', r.data_inicio)
--   FROM propostas_planos_2027 pr
--   LEFT JOIN LATERAL (SELECT * FROM pix_recorrencias x WHERE x.proposta_id = pr.id ORDER BY x.created_at DESC LIMIT 1) r ON true
--   WHERE pr.id = p_proposta
-- $$;
-- REVOKE ALL ON FUNCTION public.fn_pix_automatico_2027_estado(uuid) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.fn_pix_automatico_2027_estado(uuid) TO service_role;
-- (A volta completa da P2a, acima, já remove a função inteira.)
