DO $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims','{"sub":"8b6bcd66-79fe-498f-9476-f5cac888bfd7","role":"authenticated"}', true);
  r := public.fn_agendar_servico('99f42f7b-565b-4313-b771-75e2772450de'::uuid, (current_date+3)::date);
  RAISE NOTICE 'resultado: %', r;
END $$;