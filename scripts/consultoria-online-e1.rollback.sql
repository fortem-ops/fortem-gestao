-- Volta da E1 Consultoria Online (migração 0195). Só roda se nenhum plano usar os itens novos.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.planos p JOIN public.planos_catalogo c ON c.id = p.catalogo_id
             WHERE c.familia = 'consultoria_2027') THEN
    RAISE EXCEPTION 'Há planos vendidos da Consultoria Online; não reverter.';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.fn_aluno_somente_online(uuid);
DELETE FROM public.planos_catalogo WHERE familia = 'consultoria_2027';

ALTER TABLE public.planos_catalogo DROP CONSTRAINT planos_catalogo_modalidade_ck;
ALTER TABLE public.planos_catalogo ADD CONSTRAINT planos_catalogo_modalidade_ck
  CHECK (modalidade_cobranca IS NULL OR modalidade_cobranca = ANY (ARRAY['recorrencia_mensal'::text, 'anual'::text]));
ALTER TABLE public.planos_catalogo DROP CONSTRAINT planos_catalogo_atividade_check;
ALTER TABLE public.planos_catalogo ADD CONSTRAINT planos_catalogo_atividade_check
  CHECK (atividade = ANY (ARRAY['treinamento_funcional'::text, 'corrida'::text]));
COMMENT ON COLUMN public.planos_catalogo.periodo_meses IS NULL;
