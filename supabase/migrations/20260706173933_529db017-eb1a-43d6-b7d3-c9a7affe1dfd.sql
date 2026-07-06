ALTER TABLE public.avaliacoes DROP CONSTRAINT avaliacoes_tipo_check;
ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'funcional'::text,
    'composicao_corporal'::text,
    'pliometria'::text,
    'forca'::text,
    'experimental'::text,
    'kinology'::text,
    'funcional_v2'::text
  ]));