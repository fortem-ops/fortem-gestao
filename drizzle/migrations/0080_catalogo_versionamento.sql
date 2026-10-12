ALTER TABLE public.planos_catalogo
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS familia text,
  ADD COLUMN IF NOT EXISTS versao integer,
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS modalidade_cobranca text,
  ADD COLUMN IF NOT EXISTS liberacao_creditos text,
  ADD COLUMN IF NOT EXISTS taxa_recorrencia numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fidelidade_meses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS licenca_dias integer,
  ADD COLUMN IF NOT EXISTS avaliacoes_funcionais_meses integer[],
  ADD COLUMN IF NOT EXISTS permite_fixar_horario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bota_compressao_mes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nivel_clube text,
  ADD COLUMN IF NOT EXISTS reposicao_saldo_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brindes jsonb,
  ADD COLUMN IF NOT EXISTS vendavel_desde date,
  ADD COLUMN IF NOT EXISTS vendavel_ate date;

CREATE UNIQUE INDEX IF NOT EXISTS planos_catalogo_codigo_uk ON public.planos_catalogo(codigo) WHERE codigo IS NOT NULL;

ALTER TABLE public.planos_catalogo
  ADD CONSTRAINT planos_catalogo_modalidade_ck CHECK (modalidade_cobranca IS NULL OR modalidade_cobranca IN ('recorrencia_mensal','anual')),
  ADD CONSTRAINT planos_catalogo_liberacao_ck CHECK (liberacao_creditos IS NULL OR liberacao_creditos IN ('mensal','total_na_compra')),
  ADD CONSTRAINT planos_catalogo_nivel_clube_ck CHECK (nivel_clube IS NULL OR nivel_clube IN ('bronze','prata','ouro','diamante','platina')),
  ADD CONSTRAINT planos_catalogo_reposicao_ck CHECK (reposicao_saldo_pct BETWEEN 0 AND 100);

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS catalogo_id uuid REFERENCES public.planos_catalogo(id),
  ADD COLUMN IF NOT EXISTS plano_codigo text;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS catalogo_id uuid REFERENCES public.planos_catalogo(id);

ALTER TABLE public.contratos DROP CONSTRAINT contratos_plano_tipo_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_plano_tipo_check CHECK (plano_tipo = ANY (ARRAY['start','start_plus','power','pro','max','corrida','gympass','wellhub','totalpass','outro','start_2027','power_2027','pro_2027']));

CREATE OR REPLACE FUNCTION public.fn_planos_catalogo_protege_versao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.codigo IS DISTINCT FROM OLD.codigo OR NEW.familia IS DISTINCT FROM OLD.familia
      OR NEW.versao IS DISTINCT FROM OLD.versao OR NEW.liberacao_creditos IS DISTINCT FROM OLD.liberacao_creditos)
     AND EXISTS (SELECT 1 FROM public.planos WHERE catalogo_id = OLD.id) THEN
    RAISE EXCEPTION 'Item do catálogo já vendido: codigo/familia/versao/liberacao_creditos não podem ser alterados';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_planos_catalogo_protege_versao
BEFORE UPDATE ON public.planos_catalogo
FOR EACH ROW EXECUTE FUNCTION public.fn_planos_catalogo_protege_versao();