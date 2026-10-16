CREATE OR REPLACE FUNCTION public.fn_concluir_tarefas_por_reabilitacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _s record;
  _alvo uuid;
  _dl date;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF lower(COALESCE(NEW.tipo,'')) NOT LIKE '%reabilita%' THEN RETURN NEW; END IF;

  FOR _s IN
    SELECT n.fin, ((n.fin)::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM (
      SELECT s->>'finalizado_em' AS fin
      FROM jsonb_array_elements(COALESCE(NEW.dados->'sessoes','[]'::jsonb)) s
      WHERE COALESCE(s->>'finalizado_em','') <> ''
      EXCEPT ALL
      SELECT s->>'finalizado_em'
      FROM jsonb_array_elements(CASE WHEN TG_OP='UPDATE' THEN COALESCE(OLD.dados->'sessoes','[]'::jsonb) ELSE '[]'::jsonb END) s
      WHERE COALESCE(s->>'finalizado_em','') <> ''
    ) n
    ORDER BY 1
  LOOP
    _alvo := NULL;
    SELECT id, data_limite INTO _alvo, _dl FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id AND tipo_auto='relatorio_reabilitacao' AND status <> 'concluida'
      AND data_limite = _s.dia
    ORDER BY created_at LIMIT 1;
    IF _alvo IS NULL THEN
      SELECT id, data_limite INTO _alvo, _dl FROM public.tarefas
      WHERE aluno_id = NEW.aluno_id AND tipo_auto='relatorio_reabilitacao' AND status <> 'concluida'
        AND data_limite <= LEAST(_s.dia, CURRENT_DATE)
      ORDER BY data_limite, created_at LIMIT 1;
    END IF;
    IF _alvo IS NOT NULL THEN
      DELETE FROM public.tarefas WHERE id = _alvo;
      INSERT INTO public.system_logs (modulo, acao, mensagem, payload, user_id)
      VALUES ('tarefas','reabilitacao_concluida','Tarefa de evolução concluída por sessão finalizada',
        jsonb_build_object('tarefa_id',_alvo,'data_limite',_dl,'aluno_id',NEW.aluno_id,'avaliacao_id',NEW.id,'sessao_finalizada_em',_s.fin),
        auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_tarefa_reabilitacao_reagendada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.aluno_id IS NULL OR COALESCE(NEW.atividade,'') NOT ILIKE '%reabilita%' THEN RETURN NEW; END IF;
  IF OLD.data_especifica IS NOT DISTINCT FROM NEW.data_especifica AND OLD.horario_fim IS NOT DISTINCT FROM NEW.horario_fim THEN RETURN NEW; END IF;
  IF OLD.data_especifica IS NULL OR NEW.data_especifica IS NULL THEN RETURN NEW; END IF;
  UPDATE public.tarefas SET data_limite = NEW.data_especifica, hora_limite = NEW.horario_fim,
    descricao = replace(COALESCE(descricao,''), to_char(OLD.data_especifica,'DD/MM/YYYY'), to_char(NEW.data_especifica,'DD/MM/YYYY'))
  WHERE id = (SELECT id FROM public.tarefas WHERE aluno_id = NEW.aluno_id AND tipo_auto='relatorio_reabilitacao'
      AND status <> 'concluida' AND data_limite = OLD.data_especifica ORDER BY created_at LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public.tarefas WHERE aluno_id = NEW.aluno_id AND tipo_auto='relatorio_reabilitacao'
      AND status <> 'concluida' AND data_limite = NEW.data_especifica AND NEW.data_especifica <> OLD.data_especifica);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tarefa_reabilitacao_reagendada ON public.agenda_servicos;
CREATE TRIGGER trg_tarefa_reabilitacao_reagendada AFTER UPDATE OF data_especifica, horario_fim ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_reabilitacao_reagendada();