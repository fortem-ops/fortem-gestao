CREATE OR REPLACE FUNCTION public.fn_festa_total_novo(p_acompanhantes integer, p_isento boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF p_acompanhantes IS NULL OR p_acompanhantes < 0 OR p_acompanhantes > 3 THEN
    RAISE EXCEPTION 'Quantidade de acompanhantes inválida';
  END IF;
  RETURN CASE WHEN p_isento THEN 0 ELSE (1 + p_acompanhantes) * 7500 END;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_festa_total_novo(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_festa_total_novo(integer, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_festa_calcular_insercao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NEW.acompanhantes IS NULL OR NOT public.festa_acompanhantes_validos(NEW.acompanhantes) THEN
    RAISE EXCEPTION 'Acompanhantes inválidos';
  END IF;
  n := jsonb_array_length(NEW.acompanhantes);
  NEW.total_pessoas := 1 + n;
  NEW.total_centavos := public.fn_festa_total_novo(n, NEW.status = 'isento');
  IF NEW.status = 'confirmado' THEN
    NEW.pago_valor_centavos := NEW.total_centavos;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_festa_calcular_insercao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_festa_calcular_insercao() TO authenticated, service_role;
CREATE TRIGGER festa_calcular_insercao BEFORE INSERT ON public.festa_confirmacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_festa_calcular_insercao();
COMMENT ON FUNCTION public.fn_festa_total_novo(integer, boolean) IS 'Preço para novas confirmações somente. Históricos e PIX existentes mantêm seu total armazenado.';