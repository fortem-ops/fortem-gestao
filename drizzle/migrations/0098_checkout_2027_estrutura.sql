-- Fase 2A: estrutura do checkout /planos 2027. Somente colunas novas (nulas, sem default) e uma tabela nova.
ALTER TABLE public.propostas_planos_2027
  ADD COLUMN IF NOT EXISTS etapa_checkout text,
  ADD COLUMN IF NOT EXISTS chave_sessao_hash text,
  ADD COLUMN IF NOT EXISTS expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS etapa_atualizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cpf_hash text,
  ADD COLUMN IF NOT EXISTS cpf_cifrado bytea,
  ADD COLUMN IF NOT EXISTS contratante jsonb,
  ADD COLUMN IF NOT EXISTS revisao jsonb,
  ADD COLUMN IF NOT EXISTS aceite_id uuid;

ALTER TABLE public.propostas_planos_2027
  ADD CONSTRAINT propostas_planos_2027_etapa_checkout_check
  CHECK (etapa_checkout IS NULL OR etapa_checkout IN ('rascunho','identificada','contrato_aceito','aguardando_pagamento','paga','falhou','expirada'));

COMMENT ON COLUMN public.propostas_planos_2027.etapa_checkout IS 'Etapa do checkout do site; status continua sendo o da equipe';
COMMENT ON COLUMN public.propostas_planos_2027.chave_sessao_hash IS 'SHA-256 da chave de sessão guardada no navegador';
COMMENT ON COLUMN public.propostas_planos_2027.contratante IS 'Dados do contratante do contrato (sem CPF)';

-- Colunas para o documento definitivo (preenchidas só na Fase 5, ao criar aluno e contrato).
ALTER TABLE public.contratos_documentos
  ADD COLUMN IF NOT EXISTS hash_texto text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS proposta_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS contratos_documentos_proposta_uidx
  ON public.contratos_documentos(proposta_id) WHERE proposta_id IS NOT NULL;

-- Aceite do site, preso à proposta (ainda não há aluno nem contrato comercial).
CREATE TABLE public.propostas_2027_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas_planos_2027(id),
  template_id uuid NOT NULL REFERENCES public.contrato_templates(id),
  template_versao integer NOT NULL,
  regulamento_versao integer NOT NULL,
  conteudo_html text NOT NULL,
  variaveis jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_texto text NOT NULL,
  valor_total_centavos bigint NOT NULL,
  ip text,
  user_agent text,
  origem text NOT NULL DEFAULT 'site',
  aceito_em timestamptz NOT NULL DEFAULT now(),
  invalidado_em timestamptz,
  motivo_invalidacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.propostas_2027_aceites TO authenticated;
GRANT ALL ON public.propostas_2027_aceites TO service_role;
ALTER TABLE public.propostas_2027_aceites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê aceites do site" ON public.propostas_2027_aceites
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE UNIQUE INDEX propostas_2027_aceites_ativo_uidx
  ON public.propostas_2027_aceites(proposta_id) WHERE invalidado_em IS NULL;

INSERT INTO public.sistema_config(chave, valor, descricao)
VALUES ('planos_checkout_ativo', 'false'::jsonb, 'Checkout do /planos 2027 aberto ao público; false = só alunos de vendas_2027_teste_aluno_ids')
ON CONFLICT (chave) DO NOTHING;