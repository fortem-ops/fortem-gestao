CREATE OR REPLACE FUNCTION public.fn_clube_conceder_badge(p_aluno_id uuid, p_badge_nome text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _badge_id uuid;
  _rows int := 0;
BEGIN
  IF p_aluno_id IS NULL THEN RETURN false; END IF;

  SELECT id INTO _badge_id FROM public.clube_badges WHERE nome = p_badge_nome AND ativo = true LIMIT 1;
  IF _badge_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.clube_aluno_badges (aluno_id, badge_id, conquistado_em)
  VALUES (p_aluno_id, _badge_id, now())
  ON CONFLICT (aluno_id, badge_id) DO NOTHING;

  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_treino_agendamento_pontuar_clube()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'realizado' AND (OLD.status IS DISTINCT FROM 'realizado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clube_historico
      WHERE referencia_id = NEW.id AND referencia_tipo = 'treino_agendamento' AND acao = 'treino_realizado'
    ) THEN
      PERFORM public.fn_clube_adicionar_pontos(NEW.aluno_id, 'treino_realizado', NEW.id, 'treino_agendamento');
    END IF;

    PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, 'Primeiro Passo');

    IF EXISTS (
      SELECT 1 FROM public.clube_clima_cache c
      WHERE c.data = NEW.data AND c.multiplicador_ativo = true
    ) THEN
      PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, 'Guerreiro da Chuva');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_clube_indicacao_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _total int;
BEGIN
  IF NEW.status = 'convertido' THEN
    SELECT count(*) INTO _total
    FROM public.clube_indicacoes
    WHERE padrinho_id = NEW.padrinho_id AND status = 'convertido';

    IF _total >= 3 THEN
      PERFORM public.fn_clube_conceder_badge(NEW.padrinho_id, 'Embaixador FORTEM');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clube_indicacao_badge ON public.clube_indicacoes;
CREATE TRIGGER trg_clube_indicacao_badge
AFTER INSERT OR UPDATE OF status ON public.clube_indicacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_clube_indicacao_badge();