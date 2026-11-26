-- Fase 1: Reativar comissão de Avaliação Funcional e incluir /planos (site_2027) e planos 2027 na conversão de experimental

UPDATE public.comissionamento_config
SET ativo = true, updated_at = now()
WHERE tipo = 'avaliacao_funcional';

CREATE OR REPLACE FUNCTION public.fn_tentar_comissao_experimental(_aluno uuid, _profissional uuid, _agenda uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tem_venda_paga boolean;
  _comissao_id uuid;
BEGIN
  IF _aluno IS NULL OR _profissional IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendas v
    WHERE v.aluno_id = _aluno
      AND v.status_pagamento = 'pago'
      AND v.plano_id IS NOT NULL
      AND COALESCE(v.origem, '') <> 'teste_2027'
  ) INTO _tem_venda_paga;

  IF NOT _tem_venda_paga THEN RETURN; END IF;

  _comissao_id := public.fn_gerar_comissao(
    'treino_experimental', _profissional, _aluno, 'agenda_servicos', _agenda,
    'Conversão de Treino Experimental'
  );

  IF _comissao_id IS NOT NULL THEN
    UPDATE public.comissionamentos
    SET status = 'aprovado', aprovado_por = _profissional
    WHERE id = _comissao_id;
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.trg_comissao_venda_paga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  -- Vendas de teste nunca geram comissão; vendas do site (/planos, origem = 'site_2027') e balcão 2027 entram normalmente
  IF COALESCE(NEW.origem, '') = 'teste_2027' THEN RETURN NEW; END IF;

  IF NEW.status_pagamento = 'pago' AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento) THEN
    FOR r IN
      SELECT DISTINCT p.profissional_id, p.agenda_id
      FROM public.comissionamento_pendencias p
      WHERE p.aluno_id = NEW.aluno_id
        AND p.tipo_pendencia = 'avaliar_experimental'
        AND p.concluido = true
    LOOP
      PERFORM public.fn_tentar_comissao_experimental(NEW.aluno_id, r.profissional_id, r.agenda_id);
    END LOOP;
  END IF;

  -- Cancelamento
  IF NEW.status_pagamento = 'cancelado' AND (TG_OP = 'UPDATE' AND OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento) THEN
    UPDATE public.comissionamentos
    SET status = 'cancelado', observacoes = COALESCE(observacoes,'') || ' [venda cancelada]'
    WHERE aluno_id = NEW.aluno_id AND tipo = 'treino_experimental' AND status NOT IN ('pago','cancelado');
  END IF;

  RETURN NEW;
END
$function$;