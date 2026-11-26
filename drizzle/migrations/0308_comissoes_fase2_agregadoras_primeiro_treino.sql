CREATE OR REPLACE FUNCTION public.fn_tentar_comissao_agregadora(
  _aluno uuid,
  _data_treino date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _agregadora text;
  _profissional uuid;
  _agenda uuid;
  _comissao_id uuid;
BEGIN
  IF _aluno IS NULL THEN RETURN NULL; END IF;

  -- Aluno precisa existir, não ser da equipe e não estar inativo
  IF NOT EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.id = _aluno
      AND COALESCE(a.is_equipe, false) = false
  ) THEN
    RETURN NULL;
  END IF;

  IF public.fn_aluno_inativo(_aluno) THEN
    RETURN NULL;
  END IF;

  -- Já possui comissão de conversão ativa (venda direta ou agregadora)? Não duplicar.
  IF EXISTS (
    SELECT 1 FROM public.comissionamentos c
    WHERE c.aluno_id = _aluno
      AND c.tipo = 'treino_experimental'
      AND c.status <> 'cancelado'
  ) THEN
    RETURN NULL;
  END IF;

  -- Precisa ter vínculo de agregadora (Wellhub/Gympass ou TotalPass) com início <= data do treino
  SELECT CASE WHEN c.plano_tipo = 'gympass' THEN 'Wellhub' ELSE 'TotalPass' END
  INTO _agregadora
  FROM public.contratos c
  WHERE c.aluno_id = _aluno
    AND c.plano_tipo IN ('gympass', 'totalpass')
    AND c.status <> 'cancelado'
    AND c.data_inicio <= COALESCE(_data_treino, CURRENT_DATE)
  ORDER BY c.data_inicio ASC
  LIMIT 1;

  IF _agregadora IS NULL THEN
    RETURN NULL;
  END IF;

  -- Precisa ter treino experimental concluído previamente
  SELECT p.profissional_id, p.agenda_id
  INTO _profissional, _agenda
  FROM public.comissionamento_pendencias p
  WHERE p.aluno_id = _aluno
    AND p.tipo_pendencia = 'avaliar_experimental'
    AND p.concluido = true
  ORDER BY p.concluido_em DESC NULLS LAST, p.created_at DESC
  LIMIT 1;

  IF _profissional IS NULL THEN
    RETURN NULL;
  END IF;

  _comissao_id := public.fn_gerar_comissao(
    'treino_experimental',
    _profissional,
    _aluno,
    'agenda_servicos',
    _agenda,
    'Conversão de Treino Experimental (' || _agregadora || ')'
  );

  IF _comissao_id IS NOT NULL THEN
    UPDATE public.comissionamentos
    SET status = 'em_validacao',
        data_referencia = COALESCE(_data_treino, CURRENT_DATE),
        updated_at = now()
    WHERE id = _comissao_id
      AND status = 'pendente';
  END IF;

  RETURN _comissao_id;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_tentar_comissao_agregadora(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_tentar_comissao_agregadora(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_comissao_agregadora_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'realizado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'realizado') THEN
    PERFORM public.fn_tentar_comissao_agregadora(NEW.aluno_id, NEW.data);
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.trg_comissao_agregadora_agendamento() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_comissao_agregadora_agendamento ON public.treino_agendamentos;
CREATE TRIGGER trg_comissao_agregadora_agendamento
  AFTER INSERT OR UPDATE OF status ON public.treino_agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comissao_agregadora_agendamento();

CREATE OR REPLACE FUNCTION public.trg_comissao_agregadora_sessao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.concluido_em IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.concluido_em IS NULL) THEN
    PERFORM public.fn_tentar_comissao_agregadora(NEW.aluno_id, NEW.data);
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.trg_comissao_agregadora_sessao() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_comissao_agregadora_sessao ON public.treino_sessoes;
CREATE TRIGGER trg_comissao_agregadora_sessao
  AFTER INSERT OR UPDATE OF concluido_em ON public.treino_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comissao_agregadora_sessao();

CREATE OR REPLACE FUNCTION public.trg_comissao_agregadora_contrato_cancelado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plano_tipo IN ('gympass', 'totalpass')
     AND NEW.status = 'cancelado'
     AND OLD.status IS DISTINCT FROM 'cancelado' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.aluno_id = NEW.aluno_id
        AND c.plano_tipo IN ('gympass', 'totalpass')
        AND c.status <> 'cancelado'
        AND c.id <> NEW.id
    ) THEN
      UPDATE public.comissionamentos
      SET status = 'cancelado',
          observacoes = TRIM(BOTH ' ' FROM COALESCE(observacoes, '') || ' [vínculo agregadora cancelado]'),
          updated_at = now()
      WHERE aluno_id = NEW.aluno_id
        AND tipo = 'treino_experimental'
        AND status IN ('pendente', 'em_validacao');
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.trg_comissao_agregadora_contrato_cancelado() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_comissao_agregadora_contrato_cancelado ON public.contratos;
CREATE TRIGGER trg_comissao_agregadora_contrato_cancelado
  AFTER UPDATE OF status ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comissao_agregadora_contrato_cancelado();

CREATE OR REPLACE FUNCTION public.fn_comissao_aprovar(_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _count integer := 0;
  r record;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar comissões.' USING ERRCODE = '42501';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id, status, aprovado_por
    FROM public.comissionamentos
    WHERE id = ANY(_ids)
      AND status IN ('pendente', 'em_validacao')
    FOR UPDATE
  LOOP
    UPDATE public.comissionamentos
    SET status = 'aprovado',
        aprovado_por = _uid,
        updated_at = now()
    WHERE id = r.id;

    INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
    VALUES (
      'comissionamentos',
      r.id::text,
      'update',
      _uid,
      jsonb_build_object('status', r.status, 'aprovado_por', r.aprovado_por),
      jsonb_build_object('status', 'aprovado', 'aprovado_por', _uid)
    );

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_comissao_aprovar(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_comissao_aprovar(uuid[]) TO authenticated, service_role;