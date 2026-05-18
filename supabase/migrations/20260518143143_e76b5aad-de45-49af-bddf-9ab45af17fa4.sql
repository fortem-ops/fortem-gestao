
ALTER TABLE public.agenda_servicos
  ADD COLUMN IF NOT EXISTS credito_origem text NULL
  CHECK (credito_origem IS NULL OR credito_origem IN ('plano','servico'));

CREATE OR REPLACE FUNCTION public.fn_agenda_debitar_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _credito record;
  _has_atividade boolean;
BEGIN
  IF NEW.aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id AND atividade = NEW.atividade
  ) INTO _has_atividade;

  IF NOT _has_atividade THEN
    RETURN NEW;
  END IF;

  -- FIFO: pega a primeira linha ativa, não vencida, com saldo (ou ilimitada),
  -- respeitando a origem escolhida no agendamento quando informada.
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
