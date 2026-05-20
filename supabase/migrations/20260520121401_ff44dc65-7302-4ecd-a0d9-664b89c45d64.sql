ALTER TABLE public.avaliacao_tipos DROP CONSTRAINT IF EXISTS avaliacao_tipos_engine_check;
ALTER TABLE public.avaliacao_tipos ADD CONSTRAINT avaliacao_tipos_engine_check
  CHECK (engine = ANY (ARRAY['dinamico'::text, 'funcional_fixo'::text, 'composicao_pollock'::text, 'funcional_v2'::text]));

INSERT INTO public.avaliacao_tipos (slug, nome, icone, engine, ordem, ativo, is_sistema)
VALUES ('funcional_v2', 'Avaliação Funcional (Nova)', 'activity', 'funcional_v2', 15, true, true)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, engine = EXCLUDED.engine, ativo = true;