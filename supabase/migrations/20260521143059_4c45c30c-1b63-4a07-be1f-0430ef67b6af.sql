
-- 1) Auto-aprovar comissão de treino experimental
CREATE OR REPLACE FUNCTION public.fn_tentar_comissao_experimental(
  _aluno uuid, _profissional uuid, _agenda uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 2) Trigger em avaliacoes: concluir automaticamente a pendência avaliar_experimental
CREATE OR REPLACE FUNCTION public.trg_avaliacao_experimental_conclui_pendencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'experimental' THEN
    UPDATE public.comissionamento_pendencias
    SET concluido = true,
        concluido_em = now(),
        responsavel_id = NEW.avaliador_id,
        avaliacao_id = NEW.id
    WHERE id = (
      SELECT id FROM public.comissionamento_pendencias
      WHERE aluno_id = NEW.aluno_id
        AND tipo_pendencia = 'avaliar_experimental'
        AND concluido = false
      ORDER BY created_at DESC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_avaliacao_experimental_conclui_pendencia ON public.avaliacoes;
CREATE TRIGGER trg_avaliacao_experimental_conclui_pendencia
AFTER INSERT ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_avaliacao_experimental_conclui_pendencia();
