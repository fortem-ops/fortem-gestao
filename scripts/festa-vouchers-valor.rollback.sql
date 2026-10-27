-- Rollback vouchers em valor (27/10/2026)
DROP FUNCTION IF EXISTS public.fn_festa_voucher_criar(text,text,integer);
-- Restaurar fn_festa_calcular_insercao usando public.fn_festa_total_novo(n, NEW.status = 'isento') sem leitura do voucher.
DROP POLICY IF EXISTS festa_vouchers_gestao_ler ON public.festa_vouchers;
DROP POLICY IF EXISTS festa_vouchers_gestao_editar ON public.festa_vouchers;
REVOKE SELECT, UPDATE ON public.festa_vouchers FROM authenticated;
UPDATE public.festa_vouchers SET ativo=false WHERE desconto_centavos_pessoa IS NOT NULL;
