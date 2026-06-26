
-- 1. Nova coluna de vínculo venda <-> cobrança
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_cobranca_id ON public.vendas(cobranca_id);

-- 2. Backfill: contratos + ciclos + cobranças para planos recorrentes ativos sem contrato
WITH src AS (
  SELECT
    p.id                AS plano_id,
    p.aluno_id,
    p.tipo              AS plano_tipo_raw,
    p.valor             AS valor,
    p.data_inicio::date AS data_inicio,
    p.proxima_renovacao::date AS proxima_renovacao,
    CASE
      WHEN a.frequencia_semanal IN (1,2,3,5) THEN a.frequencia_semanal
      ELSE 2
    END AS freq,
    CASE lower(trim(p.tipo))
      WHEN 'start'           THEN 'start'
      WHEN 'start+'          THEN 'start_plus'
      WHEN 'start plus'      THEN 'start_plus'
      WHEN 'power'           THEN 'power'
      WHEN 'pro'             THEN 'pro'
      WHEN 'max'             THEN 'max'
      WHEN 'vip'             THEN 'pro'
      WHEN 'vip 3x/semana'   THEN 'pro'
      WHEN 'gympass/wellhub' THEN 'gympass'
      WHEN 'gympass'         THEN 'gympass'
      WHEN 'wellhub'         THEN 'wellhub'
      WHEN 'total pass'      THEN 'totalpass'
      WHEN 'totalpass'       THEN 'totalpass'
      WHEN 'corrida'         THEN 'corrida'
      ELSE 'outro'
    END AS plano_tipo
  FROM public.planos p
  JOIN public.alunos a ON a.id = p.aluno_id
  WHERE p.ativo = true
    AND p.renovacao_automatica = true
    AND p.proxima_renovacao IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.aluno_id = p.aluno_id)
),
ins_contratos AS (
  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento,
    valor_base, valor_cobrado, taxa_recorrencia, parcelas, status
  )
  SELECT
    s.aluno_id, s.plano_id, s.plano_tipo, s.freq,
    CASE WHEN s.freq = 5 THEN 20 ELSE s.freq * 4 END,
    'mensal', s.data_inicio, s.proxima_renovacao, 'cartao_recorrencia',
    COALESCE(s.valor, 0), COALESCE(s.valor, 0), 0, 1, 'ativo'
  FROM src s
  RETURNING id, aluno_id, data_inicio, data_fim, creditos_total, valor_cobrado
),
ins_ciclos AS (
  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  SELECT id, creditos_total, data_inicio, data_fim, 'ativo'
  FROM ins_contratos
  RETURNING id, contrato_id
),
-- Para cada contrato, encontra a venda de renovação correspondente ao ciclo atual (data_venda = data_inicio do ciclo)
matched_venda AS (
  SELECT DISTINCT ON (ic.id)
    ic.id          AS contrato_id,
    ic.aluno_id,
    ic.data_inicio AS data_vencimento,
    ic.valor_cobrado,
    v.id           AS venda_id,
    v.status_pagamento,
    v.data_venda
  FROM ins_contratos ic
  LEFT JOIN public.vendas v
    ON v.aluno_id = ic.aluno_id
   AND v.tipo = 'plano'
   AND v.data_venda = ic.data_inicio
  ORDER BY ic.id, v.created_at DESC NULLS LAST
),
ins_cobrancas AS (
  INSERT INTO public.cobrancas (
    contrato_id, aluno_id, numero_ciclo, valor, data_vencimento,
    data_pagamento, status, forma_pagamento, meio_registro, gateway
  )
  SELECT
    mv.contrato_id, mv.aluno_id, 1, mv.valor_cobrado, mv.data_vencimento,
    CASE WHEN mv.status_pagamento = 'pago' THEN COALESCE(mv.data_venda, CURRENT_DATE) END,
    CASE WHEN mv.status_pagamento = 'pago' THEN 'pago' ELSE 'pendente' END,
    'cartao_recorrencia', 'automatico', 'rede'
  FROM matched_venda mv
  RETURNING id, contrato_id
)
-- Liga a venda à cobrança recém-criada (para sincronização futura)
UPDATE public.vendas v
SET cobranca_id = ic.id
FROM ins_cobrancas ic
JOIN public.contratos c ON c.id = ic.contrato_id
WHERE v.cobranca_id IS NULL
  AND v.aluno_id = c.aluno_id
  AND v.tipo = 'plano'
  AND v.data_venda = c.data_inicio;

-- 3. Triggers de sincronização venda <-> cobrança
CREATE OR REPLACE FUNCTION public.fn_sync_venda_to_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.cobranca_id IS NOT NULL
     AND NEW.status_pagamento = 'pago'
     AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento)
  THEN
    UPDATE public.cobrancas
       SET status = 'pago',
           data_pagamento = COALESCE(data_pagamento, NEW.data_venda, CURRENT_DATE)
     WHERE id = NEW.cobranca_id
       AND status <> 'pago';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_venda_to_cobranca ON public.vendas;
CREATE TRIGGER trg_sync_venda_to_cobranca
AFTER INSERT OR UPDATE OF status_pagamento, cobranca_id ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_venda_to_cobranca();

CREATE OR REPLACE FUNCTION public.fn_sync_cobranca_to_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'pago'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.vendas
       SET status_pagamento = 'pago'
     WHERE cobranca_id = NEW.id
       AND status_pagamento <> 'pago';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cobranca_to_venda ON public.cobrancas;
CREATE TRIGGER trg_sync_cobranca_to_venda
AFTER INSERT OR UPDATE OF status ON public.cobrancas
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cobranca_to_venda();

REVOKE EXECUTE ON FUNCTION public.fn_sync_venda_to_cobranca() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_sync_cobranca_to_venda() FROM PUBLIC;
