ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_vigencia_tipo_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_vigencia_tipo_check
  CHECK (vigencia_tipo = ANY (ARRAY['mensal'::text, 'semestral'::text, 'anual'::text]));

ALTER TABLE public.planos_catalogo ADD COLUMN IF NOT EXISTS plano_base_requerido text;

INSERT INTO public.planos_catalogo (nome, periodo_meses, frequencia, quantidade_creditos, ilimitado, valor, ativo, plano_base_requerido)
VALUES
  ('Corrida', 1,  'livre', NULL, true, 200.00,  true, NULL),
  ('Corrida', 6,  'livre', NULL, true, 1080.00, true, NULL),
  ('Corrida', 12, 'livre', NULL, true, 2160.00, true, NULL),
  ('Corrida', 1,  'livre', NULL, true, 170.00,  true, 'start'),
  ('Corrida', 6,  'livre', NULL, true, 960.00,  true, 'start'),
  ('Corrida', 12, 'livre', NULL, true, 1920.00, true, 'start'),
  ('Corrida', 1,  'livre', NULL, true, 170.00,  true, 'start_plus'),
  ('Corrida', 1,  'livre', NULL, true, 160.00,  true, 'power'),
  ('Corrida', 6,  'livre', NULL, true, 900.00,  true, 'power'),
  ('Corrida', 12, 'livre', NULL, true, 1800.00, true, 'power'),
  ('Corrida', 1,  'livre', NULL, true, 150.00,  true, 'pro'),
  ('Corrida', 6,  'livre', NULL, true, 840.00,  true, 'pro'),
  ('Corrida', 12, 'livre', NULL, true, 1680.00, true, 'pro'),
  ('Corrida', 1,  'livre', NULL, true, 140.00,  true, 'max'),
  ('Corrida', 6,  'livre', NULL, true, 780.00,  true, 'max'),
  ('Corrida', 12, 'livre', NULL, true, 1560.00, true, 'max');

CREATE OR REPLACE FUNCTION public.fn_auto_criar_contrato_ciclo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_freq int;
  v_tipo text;
  v_data_inicio date;
  v_data_fim date;
  v_creditos int;
  v_contrato_id uuid;
  v_existing uuid;
  v_venda_recente uuid;
  v_vigencia text;
  v_periodo int;
BEGIN
  IF COALESCE(NEW.renovacao_automatica, false) = false OR NEW.ativo = false THEN
    RETURN NEW;
  END IF;

  SELECT v.id INTO v_venda_recente
  FROM public.vendas v
  WHERE v.aluno_id = NEW.aluno_id
    AND v.tipo = 'plano'
    AND v.created_at >= now() - interval '30 seconds'
  LIMIT 1;
  IF v_venda_recente IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing FROM public.contratos WHERE plano_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  v_tipo := CASE lower(trim(NEW.tipo))
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
  END;

  IF v_tipo = 'corrida' THEN
    v_freq := NULL;
  ELSE
    SELECT CASE WHEN a.frequencia_semanal IN (1,2,3,5) THEN a.frequencia_semanal ELSE 2 END
      INTO v_freq FROM public.alunos a WHERE a.id = NEW.aluno_id;
  END IF;

  v_periodo := COALESCE(NEW.duracao_meses, 1);
  v_vigencia := CASE WHEN v_periodo = 12 THEN 'anual' WHEN v_periodo = 6 THEN 'semestral' ELSE 'mensal' END;

  v_data_inicio := NEW.data_inicio::date;
  v_data_fim    := COALESCE(NEW.proxima_renovacao::date, v_data_inicio + (v_periodo || ' months')::interval);
  v_creditos    := CASE WHEN v_tipo = 'corrida' THEN NULL
                        WHEN v_freq = 5 THEN 20
                        ELSE v_freq * 4 END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento,
    valor_base, valor_cobrado, taxa_recorrencia, parcelas, status
  ) VALUES (
    NEW.aluno_id, NEW.id, v_tipo, v_freq, v_creditos,
    v_vigencia, v_data_inicio, v_data_fim, 'cartao_recorrencia',
    COALESCE(NEW.valor, 0), COALESCE(NEW.valor, 0), 0, 1, 'ativo'
  ) RETURNING id INTO v_contrato_id;

  IF v_tipo <> 'corrida' THEN
    INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
    VALUES (v_contrato_id, v_creditos, v_data_inicio, v_data_fim, 'ativo');
  END IF;

  INSERT INTO public.cobrancas (
    contrato_id, aluno_id, numero_ciclo, valor, data_vencimento,
    status, forma_pagamento, meio_registro, gateway
  ) VALUES (
    v_contrato_id, NEW.aluno_id, 1, COALESCE(NEW.valor, 0), v_data_inicio,
    'pendente', 'cartao_recorrencia', 'automatico', 'rede'
  );

  RETURN NEW;
END;
$function$;