CREATE OR REPLACE FUNCTION public.festa_acompanhantes_validos(valor jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(valor) = 'array'
    AND jsonb_array_length(valor) <= 3
    AND NOT jsonb_path_exists(valor, '$[*] ? (@.type() != "string" || @.size() < 2 || @.size() > 120)');
$$;

CREATE TABLE public.festa_confirmacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text NULL,
  vinculo text NOT NULL,
  acompanhantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_pessoas integer NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festa_confirmacoes_nome_check CHECK (char_length(btrim(nome)) BETWEEN 2 AND 120),
  CONSTRAINT festa_confirmacoes_whatsapp_check CHECK (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  CONSTRAINT festa_confirmacoes_email_check CHECK (email IS NULL OR (char_length(email) BETWEEN 3 AND 254 AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  CONSTRAINT festa_confirmacoes_vinculo_check CHECK (vinculo IN ('aluno_atual', 'ex_aluno', 'amigo_fortem')),
  CONSTRAINT festa_confirmacoes_acompanhantes_check CHECK (public.festa_acompanhantes_validos(acompanhantes)),
  CONSTRAINT festa_confirmacoes_total_check CHECK (total_pessoas = 1 + jsonb_array_length(acompanhantes) AND total_pessoas BETWEEN 1 AND 4)
);

CREATE UNIQUE INDEX festa_confirmacoes_whatsapp_uidx ON public.festa_confirmacoes (whatsapp);

GRANT INSERT ON public.festa_confirmacoes TO anon;
GRANT SELECT, DELETE ON public.festa_confirmacoes TO authenticated;
GRANT ALL ON public.festa_confirmacoes TO service_role;

ALTER TABLE public.festa_confirmacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY festa_confirmacoes_public_insert
ON public.festa_confirmacoes
FOR INSERT
TO anon
WITH CHECK (
  id IS NOT NULL
  AND char_length(btrim(nome)) BETWEEN 2 AND 120
  AND whatsapp ~ '^55[1-9][0-9]{9,10}$'
  AND (email IS NULL OR char_length(email) BETWEEN 3 AND 254)
  AND vinculo IN ('aluno_atual', 'ex_aluno', 'amigo_fortem')
  AND public.festa_acompanhantes_validos(acompanhantes)
  AND total_pessoas = 1 + jsonb_array_length(acompanhantes)
  AND total_pessoas BETWEEN 1 AND 4
);

CREATE POLICY festa_confirmacoes_staff_select
ON public.festa_confirmacoes
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY festa_confirmacoes_staff_delete
ON public.festa_confirmacoes
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

REVOKE ALL ON FUNCTION public.festa_acompanhantes_validos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.festa_acompanhantes_validos(jsonb) TO anon, authenticated, service_role;