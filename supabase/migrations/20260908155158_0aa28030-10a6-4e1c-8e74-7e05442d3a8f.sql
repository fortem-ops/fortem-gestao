CREATE OR REPLACE FUNCTION public.fn_corrida_consumir_vaga_nb()
RETURNS TABLE(consumida boolean, vagas_utilizadas int, vagas_totais int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _u int;
  _t int;
BEGIN
  UPDATE public.corrida_campanha_itens c
     SET vagas_utilizadas = c.vagas_utilizadas + 1,
         updated_at = now()
   WHERE c.tipo = 'cortesia_nb'
     AND c.vagas_totais IS NOT NULL
     AND c.vagas_utilizadas < c.vagas_totais
  RETURNING c.vagas_utilizadas, c.vagas_totais INTO _u, _t;

  IF FOUND THEN
    RETURN QUERY SELECT true, _u, _t;
  ELSE
    SELECT c.vagas_utilizadas, c.vagas_totais INTO _u, _t
      FROM public.corrida_campanha_itens c
     WHERE c.tipo = 'cortesia_nb'
     LIMIT 1;
    RETURN QUERY SELECT false, _u, _t;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_corrida_consumir_vaga_nb() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_corrida_consumir_vaga_nb() TO service_role;