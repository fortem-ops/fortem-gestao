-- 1. Torna cpf_hash opcional (passa a ser preenchido depois pelo coordenador/aluno)
ALTER TABLE public.clube_fortem_membros ALTER COLUMN cpf_hash DROP NOT NULL;

-- 2. Função que retorna o nível do Clube com base no tipo de plano ativo do aluno.
-- Retorna NULL quando o aluno deve ser BLOQUEADO (Gympass/Total Pass).
CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tipo text;
  _nivel public.clube_nivel_membro;
  _status public.clube_status_membro;
BEGIN
  SELECT tipo INTO _tipo
  FROM public.planos
  WHERE aluno_id = _aluno_id AND ativo = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF _tipo IS NULL THEN
    RETURN jsonb_build_object('nivel', 'start', 'status', 'ativo');
  END IF;

  IF _tipo IN ('Gympass/Wellhub', 'Total Pass') THEN
    RETURN jsonb_build_object('nivel', 'start', 'status', 'bloqueado');
  END IF;

  _nivel := CASE _tipo
    WHEN 'Mensal' THEN 'start_plus'::public.clube_nivel_membro
    WHEN 'Trimestral' THEN 'power'::public.clube_nivel_membro
    WHEN 'Semestral' THEN 'pro'::public.clube_nivel_membro
    WHEN 'Anual' THEN 'max'::public.clube_nivel_membro
    ELSE 'start'::public.clube_nivel_membro
  END;

  RETURN jsonb_build_object('nivel', _nivel, 'status', 'ativo');
END $$;

-- 3. Função que cria/atualiza o membro de um aluno (idempotente).
-- Usa hash placeholder do aluno_id quando não há CPF cadastrado.
CREATE OR REPLACE FUNCTION public.fn_clube_sync_membro(_aluno_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _info jsonb;
  _nivel public.clube_nivel_membro;
  _status public.clube_status_membro;
  _existing record;
  _placeholder_hash text;
BEGIN
  _info := public.fn_clube_nivel_por_plano(_aluno_id);
  _nivel := (_info->>'nivel')::public.clube_nivel_membro;
  _status := (_info->>'status')::public.clube_status_membro;

  SELECT * INTO _existing FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id;

  IF _existing IS NULL THEN
    -- Hash placeholder determinístico baseado no aluno_id
    _placeholder_hash := encode(extensions.digest('aluno:' || _aluno_id::text, 'sha256'), 'hex');
    INSERT INTO public.clube_fortem_membros (aluno_id, cpf_hash, nivel_membro, status_membro, fortem_id)
    VALUES (_aluno_id, _placeholder_hash, _nivel, _status, '');
  ELSE
    -- Não rebaixa se já estiver cancelado pelo coordenador
    IF _existing.status_membro = 'cancelado' THEN
      RETURN;
    END IF;
    UPDATE public.clube_fortem_membros
    SET nivel_membro = _nivel,
        status_membro = _status,
        updated_at = now()
    WHERE id = _existing.id;
  END IF;
END $$;

-- 4. Triggers que mantém o membro sincronizado.
CREATE OR REPLACE FUNCTION public.trg_aluno_clube_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_clube_sync_membro(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aluno_clube_sync_ins ON public.alunos;
CREATE TRIGGER aluno_clube_sync_ins
AFTER INSERT ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.trg_aluno_clube_sync();

CREATE OR REPLACE FUNCTION public.trg_plano_clube_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_clube_sync_membro(COALESCE(NEW.aluno_id, OLD.aluno_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS plano_clube_sync_ins ON public.planos;
CREATE TRIGGER plano_clube_sync_ins
AFTER INSERT ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.trg_plano_clube_sync();

DROP TRIGGER IF EXISTS plano_clube_sync_upd ON public.planos;
CREATE TRIGGER plano_clube_sync_upd
AFTER UPDATE OF tipo, ativo ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.trg_plano_clube_sync();

-- 5. Trigger fortem_id existente já cobre auto-geração na inserção (fn_clube_generate_fortem_id).
-- Garantir que esteja anexado:
DROP TRIGGER IF EXISTS clube_membros_fortem_id ON public.clube_fortem_membros;
CREATE TRIGGER clube_membros_fortem_id
BEFORE INSERT ON public.clube_fortem_membros
FOR EACH ROW EXECUTE FUNCTION public.fn_clube_generate_fortem_id();

-- 6. Backfill: criar membros para todos os alunos existentes
DO $$
DECLARE _a record;
BEGIN
  FOR _a IN SELECT id FROM public.alunos LOOP
    PERFORM public.fn_clube_sync_membro(_a.id);
  END LOOP;
END $$;