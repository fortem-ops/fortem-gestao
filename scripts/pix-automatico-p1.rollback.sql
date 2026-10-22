-- Volta da P1 do Pix Automático (só funciona enquanto não houver mensalidade com meio 'pix_automatico').
DELETE FROM public.sistema_config WHERE chave IN ('planos_pix_automatico_ativo','planos_pix_automatico_planos','planos_pix_automatico_rotina_pausada');
ALTER TABLE public.planos_2027_mensalidades DROP CONSTRAINT IF EXISTS planos_2027_mensalidades_meio_vinculos;
ALTER TABLE public.planos_2027_mensalidades DROP CONSTRAINT IF EXISTS planos_2027_mensalidades_pix_cobranca_unica;
DROP INDEX IF EXISTS public.idx_mensalidades_2027_pix_rec;
ALTER TABLE public.planos_2027_mensalidades ALTER COLUMN tokenizacao_id SET NOT NULL;
ALTER TABLE public.planos_2027_mensalidades DROP COLUMN IF EXISTS pix_cobranca_id;
ALTER TABLE public.planos_2027_mensalidades DROP COLUMN IF EXISTS pix_recorrencia_id;
ALTER TABLE public.planos_2027_mensalidades DROP COLUMN IF EXISTS meio;
