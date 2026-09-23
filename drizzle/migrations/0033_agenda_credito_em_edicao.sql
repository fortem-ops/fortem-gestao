-- Helper: estorna créditos/consumos de plano vinculados a um agendamento
CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_credito_por_agenda(_agenda_id uuid, _motivo text DEFAULT 'Reposição — aluno alterado no agendamento')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _mov record;
  _credito record;
BEGIN
  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = _agenda_id AND tipo = 'consumo'
  LOOP
    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito.id IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
    VALUES (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(), _motivo);
  END LOOP;

  DELETE FROM public.creditos_movimentos WHERE agenda_id = _agenda_id AND tipo = 'consumo';
  DELETE FROM public.consumo_servicos WHERE agenda_id = _agenda_id;
END;
$fn$;

-- Débito passa a valer também em UPDATE (aluno vinculado/trocado/removido)
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
  IF TG_OP = 'UPDATE' THEN
    -- nada mudou no que importa: não mexe em crédito (evita débito duplicado)
    IF NEW.aluno_id IS NOT DISTINCT FROM OLD.aluno_id
       AND NEW.atividade IS NOT DISTINCT FROM OLD.atividade
       AND NEW.credito_origem IS NOT DISTINCT FROM OLD.credito_origem THEN
      RETURN NEW;
    END IF;

    IF current_setting('app.bloquear_estorno_agenda', true) IS DISTINCT FROM 'true' THEN
      PERFORM public.fn_agenda_estornar_credito_por_agenda(OLD.id);
    END IF;
  END IF;

  IF NEW.aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  _plan_label := CASE NEW.atividade
    WHEN 'Avaliação Funcional' THEN 'Avaliação Funcional'
    WHEN 'Nutrição'            THEN 'Consultas Nutrição'
    WHEN 'Reabilitação'        THEN 'Consultas Reabilitação'
    ELSE NULL
  END;

  IF _plan_label IS NOT NULL
     AND (NEW.credito_origem IS NULL OR NEW.credito_origem = 'plano') THEN

    SELECT * INTO _plano FROM public.fn_plano_principal_ativo(NEW.aluno_id);

    IF _plano.id IS NOT NULL THEN
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

  SELECT EXISTS (
    SELECT 1 FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id AND atividade = NEW.atividade AND ativo = true
  ) INTO _has_atividade;

  IF NOT _has_atividade THEN
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

DROP TRIGGER IF EXISTS trg_agenda_debitar_credito_update ON public.agenda_servicos;
CREATE TRIGGER trg_agenda_debitar_credito_update
AFTER UPDATE OF aluno_id, atividade, credito_origem ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_debitar_credito();