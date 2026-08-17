DO $$
DECLARE
  _id uuid;
BEGIN
  FOR _id IN
    SELECT id
    FROM public.ponto_jornadas
    WHERE saida IS NULL
    ORDER BY data
  LOOP
    PERFORM public.fn_ponto_calcular_divergencias(_id);
  END LOOP;
END
$$;