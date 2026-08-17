DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.ponto_jornadas WHERE saida IS NOT NULL ORDER BY data LOOP
    BEGIN
      PERFORM public.fn_ponto_calcular_divergencias(r.id);
      PERFORM public.fn_ponto_consolidar_banco(r.id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;