DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.fn_ponto_registrar(public.ponto_evento_tipo,numeric,numeric,text,text)','public.fn_ponto_estado_atual(uuid)'] LOOP
    EXECUTE replace(pg_get_functiondef(f::regprocedure), '_hoje date := CURRENT_DATE;', '_hoje date := (now() AT TIME ZONE ''America/Sao_Paulo'')::date;');
  END LOOP;
END $$;