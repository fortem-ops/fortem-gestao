REVOKE ALL ON public.planos_2027_pagamentos_avulsos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.planos_2027_pagamentos_avulsos TO authenticated;
GRANT ALL ON public.planos_2027_pagamentos_avulsos TO service_role;
REVOKE ALL ON FUNCTION public.fn_consultas_2027_guardar(),public.fn_tentativa_finalidade_2027() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.fn_consultas_2027_reservar(uuid,text) IS 'F1: service_role-only, exclusivamente simulação de proposta teste; nenhum caminho real liberado.';