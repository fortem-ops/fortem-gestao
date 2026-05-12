
-- Função: debitar 1 crédito do aluno para a atividade da agenda (FIFO por validade)
CREATE OR REPLACE FUNCTION public.fn_agenda_debitar_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _credito record;
  _has_atividade boolean;
BEGIN
  IF NEW.aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se não há nenhuma linha de crédito cadastrada para essa atividade desse aluno,
  -- não bloqueia (atividades como Treino Experimental / Recovery podem não ter crédito).
  SELECT EXISTS (
    SELECT 1 FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id AND atividade = NEW.atividade
  ) INTO _has_atividade;

  IF NOT _has_atividade THEN
    RETURN NEW;
  END IF;

  -- FIFO: pega a primeira linha ativa, não vencida, com saldo (ou ilimitada).
  SELECT * INTO _credito
  FROM public.creditos_aluno
  WHERE aluno_id = NEW.aluno_id
    AND atividade = NEW.atividade
    AND ativo = true
    AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
    AND (ilimitado = true OR quantidade_usada < quantidade_inicial)
  ORDER BY data_validade NULLS LAST, created_at
  LIMIT 1;

  IF _credito IS NULL THEN
    RAISE EXCEPTION 'Aluno sem créditos disponíveis para %', NEW.atividade;
  END IF;

  IF NOT _credito.ilimitado THEN
    UPDATE public.creditos_aluno
    SET quantidade_usada = quantidade_usada + 1, updated_at = now()
    WHERE id = _credito.id;
  END IF;

  INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
  VALUES (_credito.id, 'consumo', 1, NEW.id, auth.uid(),
          'Agenda: ' || NEW.atividade || COALESCE(' — ' || NEW.local, ''));

  RETURN NEW;
END;
$$;

-- Função: estornar consumos quando o agendamento é excluído
CREATE OR REPLACE FUNCTION public.fn_agenda_estornar_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mov record;
  _credito record;
BEGIN
  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = OLD.id AND tipo = 'consumo'
  LOOP
    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
    VALUES (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(),
            'Estorno por exclusão de agendamento');
  END LOOP;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_debitar_credito ON public.agenda_servicos;
CREATE TRIGGER trg_agenda_debitar_credito
AFTER INSERT ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_debitar_credito();

DROP TRIGGER IF EXISTS trg_agenda_estornar_credito ON public.agenda_servicos;
CREATE TRIGGER trg_agenda_estornar_credito
AFTER DELETE ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_estornar_credito();
