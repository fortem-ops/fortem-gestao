
-- Extend ponto_politica_retencao to hold the consent term text/version management
ALTER TABLE public.ponto_politica_retencao
  ADD COLUMN IF NOT EXISTS texto_termo TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS changelog TEXT,
  ADD COLUMN IF NOT EXISTS vigente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rascunho BOOLEAN NOT NULL DEFAULT false;

-- Partial unique index: at most one vigente version at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_retencao_vigente
  ON public.ponto_politica_retencao ((true)) WHERE vigente;

-- Seed: mark v1.1 as vigente and backfill texto_termo with the current hardcoded text
UPDATE public.ponto_politica_retencao
SET vigente = true,
    titulo = COALESCE(titulo, 'Termo de Consentimento de Geolocalização'),
    texto_termo = COALESCE(texto_termo, 'A FORTEM utiliza sistema eletrônico de registro de ponto por navegador, com coleta de geolocalização exclusivamente no momento da marcação de entrada, saída e intervalos, com a finalidade de comprovar o local do registro de jornada. Não há rastreamento contínuo do colaborador. Quando o colaborador não desejar utilizar dispositivo próprio, a empresa disponibilizará equipamento no local de trabalho para realização da marcação. Os dados de localização são armazenados de forma segura e retidos por 5 anos, conforme obrigação legal trabalhista (Art. 11 da CLT). Base legal: Legítimo interesse do empregador (Art. 7º, IX da LGPD) e obrigação legal (Art. 7º, II da LGPD). Versão 1.1.')
WHERE versao = '1.1';

UPDATE public.ponto_politica_retencao
SET texto_termo = COALESCE(texto_termo, 'Versão inicial da política (1.0).'),
    titulo = COALESCE(titulo, 'Termo de Consentimento de Geolocalização')
WHERE versao = '1.0';

-- Admin write policies on ponto_politica_retencao
DROP POLICY IF EXISTS "admins gerenciam politica retencao" ON public.ponto_politica_retencao;
CREATE POLICY "admins gerenciam politica retencao"
ON public.ponto_politica_retencao
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_politica_retencao TO authenticated;
GRANT ALL ON public.ponto_politica_retencao TO service_role;

-- Admin read on ponto_consentimento_geo (sub-aba Colaboradores)
DROP POLICY IF EXISTS "admins leem todos consentimentos geo" ON public.ponto_consentimento_geo;
CREATE POLICY "admins leem todos consentimentos geo"
ON public.ponto_consentimento_geo
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
