
-- 1) Cria protocolo default para funcional_v2 (idempotente por nome+tipo)
INSERT INTO public.avaliacao_protocolos (tipo_id, nome, descricao, schema, is_default, ativo, ordem, permite_upload)
SELECT
  '6bc2e5ee-be52-496c-93db-18450b878c62'::uuid,
  'Funcional + Força (padrão)',
  'Mobilidade/flexibilidade + dinamometria isométrica Kinology no mesmo registro.',
  '{}'::jsonb,
  true, true, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.avaliacao_protocolos
  WHERE tipo_id = '6bc2e5ee-be52-496c-93db-18450b878c62'
    AND nome = 'Funcional + Força (padrão)'
);

-- 2) Desativa tipos antigos
UPDATE public.avaliacao_tipos
   SET ativo = false
 WHERE slug IN ('funcional', 'forca');

-- 3) Desativa protocolos filhos dos tipos antigos
UPDATE public.avaliacao_protocolos
   SET ativo = false
 WHERE tipo_id IN (
   SELECT id FROM public.avaliacao_tipos WHERE slug IN ('funcional', 'forca')
 );
