CREATE OR REPLACE FUNCTION public.fn_desativar_planos_vencidos()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH d AS (
    UPDATE planos SET ativo = false
    WHERE ativo AND data_fim < (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND NOT coalesce(renovacao_automatica, false)
    RETURNING id
  ) SELECT count(*) INTO n FROM d;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fn_desativar_planos_vencidos() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('desativar-planos-vencidos', '30 6 * * *', $c$ SELECT public.fn_desativar_planos_vencidos(); $c$);