-- Recria view sem SECURITY DEFINER
DROP VIEW IF EXISTS public.inadimplencias_view;
CREATE VIEW public.inadimplencias_view
WITH (security_invoker = true) AS
SELECT i.*, (CURRENT_DATE - i.data_vencimento) AS dias_atraso
FROM public.inadimplencias i;

GRANT SELECT ON public.inadimplencias_view TO authenticated;
GRANT ALL  ON public.inadimplencias_view TO service_role;

-- Restringe execução da função de rescisão
REVOKE EXECUTE ON FUNCTION public.fn_calcular_rescisao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_calcular_rescisao(uuid) TO authenticated, service_role;