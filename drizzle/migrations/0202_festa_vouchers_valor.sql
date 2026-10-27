ALTER TABLE public.festa_vouchers ADD COLUMN IF NOT EXISTS desconto_centavos_pessoa integer NULL CHECK (desconto_centavos_pessoa IS NULL OR desconto_centavos_pessoa > 0), ADD COLUMN IF NOT EXISTS codigo_exibicao text NULL;

GRANT SELECT, UPDATE ON public.festa_vouchers TO authenticated;
GRANT ALL ON public.festa_vouchers TO service_role;
ALTER TABLE public.festa_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS festa_vouchers_gestao_ler ON public.festa_vouchers;
CREATE POLICY festa_vouchers_gestao_ler ON public.festa_vouchers FOR SELECT TO authenticated USING (public.fn_festa_gestao(auth.uid()));
DROP POLICY IF EXISTS festa_vouchers_gestao_editar ON public.festa_vouchers;
CREATE POLICY festa_vouchers_gestao_editar ON public.festa_vouchers FOR UPDATE TO authenticated USING (public.fn_festa_gestao(auth.uid())) WITH CHECK (public.fn_festa_gestao(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_festa_total_desconto(p_acompanhantes integer, p_isento boolean, p_desconto_pessoa integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
BEGIN
  IF p_acompanhantes IS NULL OR p_acompanhantes < 0 OR p_acompanhantes > 3 THEN RAISE EXCEPTION 'Quantidade de acompanhantes inválida'; END IF;
  IF p_isento THEN RETURN 0; END IF;
  RETURN (1 + p_acompanhantes) * GREATEST(0, 7500 - COALESCE(p_desconto_pessoa, 0));
END $$;

CREATE OR REPLACE FUNCTION public.fn_festa_calcular_insercao()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE n integer; d integer;
BEGIN
  IF NEW.acompanhantes IS NULL OR NOT public.festa_acompanhantes_validos(NEW.acompanhantes) THEN
    RAISE EXCEPTION 'Acompanhantes inválidos';
  END IF;
  n := jsonb_array_length(NEW.acompanhantes);
  NEW.total_pessoas := 1 + n;
  IF NEW.voucher_id IS NOT NULL THEN
    SELECT desconto_centavos_pessoa INTO d FROM public.festa_vouchers WHERE id = NEW.voucher_id;
  END IF;
  NEW.total_centavos := public.fn_festa_total_desconto(n, NEW.status = 'isento', d);
  IF NEW.status = 'confirmado' THEN
    NEW.pago_valor_centavos := NEW.total_centavos;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_festa_voucher_criar(p_codigo text, p_descricao text, p_desconto_centavos integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c text := lower(trim(p_codigo)); _id uuid;
BEGIN
  IF NOT public.fn_festa_gestao(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF c IS NULL OR length(c) < 3 OR length(c) > 40 THEN RAISE EXCEPTION 'Código deve ter de 3 a 40 caracteres'; END IF;
  IF p_desconto_centavos IS NULL OR p_desconto_centavos <= 0 OR p_desconto_centavos > 7500 THEN RAISE EXCEPTION 'Desconto deve ser entre R$ 0,01 e R$ 75,00'; END IF;
  IF EXISTS (SELECT 1 FROM public.festa_vouchers WHERE codigo_hash = encode(sha256(convert_to(c,'UTF8')),'hex')) THEN RAISE EXCEPTION 'Já existe um voucher com este código'; END IF;
  INSERT INTO public.festa_vouchers (codigo_hash, codigo_exibicao, descricao, desconto_pct, desconto_centavos_pessoa, ativo, usos_max, usos)
  VALUES (encode(sha256(convert_to(c,'UTF8')),'hex'), upper(trim(p_codigo)), NULLIF(trim(p_descricao),''), 0, p_desconto_centavos, true, NULL, 0)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.fn_festa_voucher_criar(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_festa_voucher_criar(text,text,integer) TO authenticated, service_role;