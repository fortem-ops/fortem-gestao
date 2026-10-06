CREATE OR REPLACE FUNCTION public.fn_festa_confirmar(
  p_nome text,
  p_whatsapp text,
  p_email text,
  p_vinculo text,
  p_acompanhantes jsonb,
  p_total_pessoas integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inseridas integer;
BEGIN
  INSERT INTO public.festa_confirmacoes (nome, whatsapp, email, vinculo, acompanhantes, total_pessoas)
  VALUES (btrim(p_nome), p_whatsapp, nullif(btrim(p_email), ''), p_vinculo, p_acompanhantes, p_total_pessoas)
  ON CONFLICT (whatsapp) DO NOTHING;

  GET DIAGNOSTICS inseridas = ROW_COUNT;
  RETURN CASE WHEN inseridas = 1 THEN 'confirmada' ELSE 'duplicada' END;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_festa_confirmar(text, text, text, text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_festa_confirmar(text, text, text, text, jsonb, integer) TO anon, service_role;