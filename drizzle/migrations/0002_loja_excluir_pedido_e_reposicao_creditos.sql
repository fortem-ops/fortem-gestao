-- 1) Exclusão administrativa de pedidos da Loja
CREATE OR REPLACE FUNCTION public.fn_loja_excluir_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pedido public.pedidos%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sem_permissao');
  END IF;

  SELECT * INTO _pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pedido_nao_encontrado');
  END IF;

  -- devolve estoque reservado (ignora pedidos já retirados)
  IF _pedido.retirado_em IS NULL THEN
    PERFORM public.fn_loja_reverter_reserva(p_pedido_id);
  END IF;

  -- devolve o uso do cupom
  IF _pedido.promocao_id IS NOT NULL THEN
    UPDATE public.promocoes
      SET uso_atual = GREATEST(0, uso_atual - 1)
      WHERE id = _pedido.promocao_id;
  END IF;

  -- remove tentativas de pagamento vinculadas (FKs sem cascade)
  DELETE FROM public.pagamentos_rede WHERE pedido_id = p_pedido_id;
  DELETE FROM public.pix_cobrancas WHERE pedido_id = p_pedido_id;
  UPDATE public.estoque_movimentos SET pedido_id = NULL WHERE pedido_id = p_pedido_id;

  DELETE FROM public.pedidos WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'pedido_id', p_pedido_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_loja_excluir_pedido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_loja_excluir_pedido(uuid) TO authenticated, service_role;

-- 2) Estorno de crédito da agenda registrado como reposição
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
  IF current_setting('app.bloquear_estorno_agenda', true) = 'true' THEN
    RETURN OLD;
  END IF;

  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = OLD.id AND tipo = 'consumo'
  LOOP
    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito.id IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
    VALUES (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(),
            'Reposição — horário removido');
  END LOOP;
  RETURN OLD;
END;
$$;

-- 3) Reposição quando um dia específico é removido de um horário recorrente
CREATE OR REPLACE FUNCTION public.fn_agenda_excecao_repor_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mov record;
  _credito record;
  _obs text := 'Reposição — dia removido (' || to_char(NEW.data_excecao, 'DD/MM/YYYY') || ')';
BEGIN
  IF current_setting('app.bloquear_estorno_agenda', true) = 'true' THEN
    RETURN NEW;
  END IF;

  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE agenda_id = NEW.agenda_id AND tipo = 'consumo'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.creditos_movimentos
      WHERE credito_id = _mov.credito_id AND tipo = 'estorno' AND observacao = _obs
    ) THEN
      CONTINUE;
    END IF;

    SELECT * INTO _credito FROM public.creditos_aluno WHERE id = _mov.credito_id;
    IF _credito.id IS NOT NULL AND NOT _credito.ilimitado THEN
      UPDATE public.creditos_aluno
      SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade), updated_at = now()
      WHERE id = _credito.id;
    END IF;

    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, agenda_id, registrado_por, observacao)
    VALUES (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(), _obs);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_excecao_repor_credito ON public.agenda_servicos_excecoes;
CREATE TRIGGER trg_agenda_excecao_repor_credito
AFTER INSERT ON public.agenda_servicos_excecoes
FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_excecao_repor_credito();

-- 4) Exclusão de treino pelo staff sempre devolve o crédito (reposição)
CREATE OR REPLACE FUNCTION public.fn_staff_excluir_treino_agendamento(p_agendamento_id uuid, p_estornar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ag treino_agendamentos%ROWTYPE;
  _reposto boolean := false;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT * INTO _ag FROM treino_agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  END IF;

  IF COALESCE(p_estornar, true) AND _ag.credito_debitado AND _ag.ciclo_id IS NOT NULL
     AND NOT COALESCE(_ag.credito_estornado, false) THEN
    UPDATE ciclos_credito
    SET creditos_usados = GREATEST(0, creditos_usados - 1)
    WHERE id = _ag.ciclo_id;
    _reposto := true;
  END IF;

  UPDATE treino_agendamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = 'staff',
    credito_estornado = COALESCE(_ag.credito_estornado, false) OR _reposto,
    observacoes = CASE WHEN _reposto
      THEN trim(both ' ' from coalesce(observacoes, '') || ' Reposição disponível — horário removido pela equipe.')
      ELSE observacoes END
  WHERE id = p_agendamento_id;

  RETURN jsonb_build_object('ok', true, 'credito_estornado', _reposto);
END;
$$;