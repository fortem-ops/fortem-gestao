
-- 1) Função de débito: prioriza créditos de "plano" via planos.servicos
CREATE OR REPLACE FUNCTION public.fn_agenda_debitar_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _credito record;
  _has_atividade boolean;
  _plano record;
  _plan_label text;
  _base int;
  _comprado int;
  _usado int;
  _restante int;
BEGIN
  IF NEW.aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mapeia atividade da agenda para rótulo usado no plano (planos.servicos / consumo_servicos.tipo_servico)
  _plan_label := CASE NEW.atividade
    WHEN 'Avaliação Funcional' THEN 'Avaliação Funcional'
    WHEN 'Nutrição'            THEN 'Consultas Nutrição'
    WHEN 'Reabilitação'        THEN 'Consultas Reabilitação'
    ELSE NULL
  END;

  -- ===== Tenta consumir do PLANO quando aplicável =====
  IF _plan_label IS NOT NULL
     AND (NEW.credito_origem IS NULL OR NEW.credito_origem = 'plano') THEN

    SELECT * INTO _plano
    FROM public.planos
    WHERE aluno_id = NEW.aluno_id
      AND ativo = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF _plano.id IS NOT NULL THEN
      -- base de créditos no array text planos.servicos: "N <label>"
      SELECT COALESCE(MAX(
               (regexp_match(s, '^(\d+)\s+(.+)$'))[1]::int
             ), 0)
        INTO _base
      FROM unnest(_plano.servicos) AS s
      WHERE (regexp_match(s, '^(\d+)\s+(.+)$'))[2] = _plan_label;

      SELECT COALESCE(SUM(quantidade), 0) INTO _comprado
      FROM public.consumo_servicos
      WHERE aluno_id = NEW.aluno_id
        AND plano_id = _plano.id
        AND tipo_servico = _plan_label
        AND tipo_registro = 'compra';

      SELECT COUNT(*) INTO _usado
      FROM public.consumo_servicos
      WHERE aluno_id = NEW.aluno_id
        AND plano_id = _plano.id
        AND tipo_servico = _plan_label
        AND (agenda_id IS NOT NULL OR tipo_registro = 'uso_manual');

      _restante := (_base + _comprado) - _usado;

      IF _restante > 0 THEN
        INSERT INTO public.consumo_servicos
          (aluno_id, plano_id, agenda_id, tipo_servico, data_consumo,
           quantidade, valor_unitario, registrado_por, tipo_registro, observacoes)
        VALUES
          (NEW.aluno_id, _plano.id, NEW.id, _plan_label, CURRENT_DATE,
           1, 0, COALESCE(auth.uid(), NEW.profissional_id), 'uso_manual',
           'Agenda: ' || NEW.atividade || COALESCE(' — ' || NEW.local, ''));
        RETURN NEW;
      ELSIF NEW.credito_origem = 'plano' THEN
        RAISE EXCEPTION 'Aluno sem créditos do plano disponíveis para %', NEW.atividade;
      END IF;
    ELSIF NEW.credito_origem = 'plano' THEN
      RAISE EXCEPTION 'Aluno não possui plano ativo para consumir % via plano', NEW.atividade;
    END IF;
  END IF;

  -- ===== Fluxo existente: créditos em creditos_aluno =====
  -- Considera apenas linhas ATIVAS na verificação de existência
  SELECT EXISTS (
    SELECT 1 FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id AND atividade = NEW.atividade AND ativo = true
  ) INTO _has_atividade;

  IF NOT _has_atividade THEN
    -- Se origem exigida é 'servico' e não existe linha ativa, erro explícito
    IF NEW.credito_origem = 'servico' THEN
      RAISE EXCEPTION 'Aluno sem créditos de serviço disponíveis para %', NEW.atividade;
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO _credito
  FROM public.creditos_aluno
  WHERE aluno_id = NEW.aluno_id
    AND atividade = NEW.atividade
    AND ativo = true
    AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
    AND (ilimitado = true OR quantidade_usada < quantidade_inicial)
    AND (NEW.credito_origem IS NULL OR origem_tipo::text = NEW.credito_origem)
  ORDER BY data_validade NULLS LAST, created_at
  LIMIT 1;

  IF _credito IS NULL THEN
    IF NEW.credito_origem IS NOT NULL THEN
      RAISE EXCEPTION 'Aluno sem créditos disponíveis para % na origem %', NEW.atividade, NEW.credito_origem;
    ELSE
      RAISE EXCEPTION 'Aluno sem créditos disponíveis para %', NEW.atividade;
    END IF;
  END IF;

  IF NOT _credito.ilimitado THEN
    UPDATE public.creditos_aluno
    SET quantidade_usada = quantidade_usada + 1, updated_at = now()
    WHERE id = _credito.id;
  END IF;

  INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
  VALUES (_credito.id, 'consumo', 1, NEW.id, auth.uid(),
          'Agenda: ' || NEW.atividade || COALESCE(' — ' || NEW.local, '') ||
          CASE WHEN NEW.credito_origem IS NOT NULL THEN ' (' || NEW.credito_origem || ')' ELSE '' END);

  RETURN NEW;
END;
$function$;

-- 2) Estorno do consumo do plano ao excluir agendamento
CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_consumo_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.consumo_servicos
  WHERE agenda_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_estornar_consumo_plano ON public.agenda_servicos;
CREATE TRIGGER trg_agenda_estornar_consumo_plano
BEFORE DELETE ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_estornar_consumo_plano();
