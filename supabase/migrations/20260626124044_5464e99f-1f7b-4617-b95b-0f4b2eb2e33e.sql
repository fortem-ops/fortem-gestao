
CREATE OR REPLACE FUNCTION public.fn_auto_criar_contrato_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freq int;
  v_tipo text;
  v_data_inicio date;
  v_data_fim date;
  v_creditos int;
  v_contrato_id uuid;
  v_existing uuid;
  v_numero_ciclo int;
BEGIN
  IF COALESCE(NEW.renovacao_automatica, false) = false OR NEW.ativo = false THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN a.frequencia_semanal IN (1,2,3,5) THEN a.frequencia_semanal ELSE 2 END
    INTO v_freq
  FROM public.alunos a WHERE a.id = NEW.aluno_id;

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

  v_data_inicio := NEW.data_inicio::date;
  v_data_fim    := COALESCE(NEW.proxima_renovacao::date, v_data_inicio + INTERVAL '1 month');
  v_creditos    := CASE WHEN v_freq = 5 THEN 20 ELSE v_freq * 4 END;

  -- Já existe contrato pra este plano?
  SELECT id INTO v_existing FROM public.contratos WHERE plano_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento,
    valor_base, valor_cobrado, taxa_recorrencia, parcelas, status
  ) VALUES (
    NEW.aluno_id, NEW.id, v_tipo, v_freq, v_creditos,
    'mensal', v_data_inicio, v_data_fim, 'cartao_recorrencia',
    COALESCE(NEW.valor, 0), COALESCE(NEW.valor, 0), 0, 1, 'ativo'
  ) RETURNING id INTO v_contrato_id;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato_id, v_creditos, v_data_inicio, v_data_fim, 'ativo');

  -- Numero do ciclo: conta contratos anteriores do mesmo aluno + 1
  SELECT COUNT(*) + 1 INTO v_numero_ciclo
  FROM public.contratos
  WHERE aluno_id = NEW.aluno_id AND id <> v_contrato_id;

  INSERT INTO public.cobrancas (
    contrato_id, aluno_id, numero_ciclo, valor, data_vencimento,
    status, forma_pagamento, meio_registro, gateway
  ) VALUES (
    v_contrato_id, NEW.aluno_id, 1, COALESCE(NEW.valor, 0), v_data_inicio,
    'pendente', 'cartao_recorrencia', 'automatico', 'rede'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_auto_criar_contrato_ciclo() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_auto_criar_contrato_ciclo ON public.planos;
CREATE TRIGGER trg_auto_criar_contrato_ciclo
AFTER INSERT ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.fn_auto_criar_contrato_ciclo();
