-- A. Adicionar cpf_hash em alunos
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS cpf_hash text;

COMMENT ON COLUMN public.alunos.cpf_hash IS
  'SHA-256 do CPF limpo (somente dígitos). Gerado por fn_clube_hash_cpf. Usar para lookups — não usar alunos.cpf.';

ALTER TABLE public.legal_annexes
  ADD COLUMN IF NOT EXISTS cpf_hash text;

COMMENT ON COLUMN public.legal_annexes.cpf_hash IS
  'SHA-256 do CPF limpo (somente dígitos). Gerado por fn_clube_hash_cpf. Usar para lookups — não usar legal_annexes.cpf.';

UPDATE public.alunos
SET cpf_hash = public.fn_clube_hash_cpf(cpf)
WHERE cpf IS NOT NULL AND cpf <> '' AND cpf_hash IS NULL;

UPDATE public.legal_annexes
SET cpf_hash = public.fn_clube_hash_cpf(cpf)
WHERE cpf IS NOT NULL AND cpf <> '' AND cpf_hash IS NULL;

CREATE INDEX IF NOT EXISTS alunos_cpf_hash_idx
  ON public.alunos (cpf_hash)
  WHERE cpf_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS legal_annexes_cpf_hash_idx
  ON public.legal_annexes (cpf_hash)
  WHERE cpf_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_sync_cpf_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    NEW.cpf_hash := public.fn_clube_hash_cpf(NEW.cpf);
  ELSE
    NEW.cpf_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cpf_hash_alunos ON public.alunos;
CREATE TRIGGER trg_sync_cpf_hash_alunos
  BEFORE INSERT OR UPDATE OF cpf ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cpf_hash();

DROP TRIGGER IF EXISTS trg_sync_cpf_hash_legal ON public.legal_annexes;
CREATE TRIGGER trg_sync_cpf_hash_legal
  BEFORE INSERT OR UPDATE OF cpf ON public.legal_annexes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cpf_hash();

CREATE OR REPLACE FUNCTION public.fn_lookup_aluno_por_cpf_hash(p_cpf_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'found',  true,
    'data', jsonb_build_object(
      'id',            a.id,
      'nome',          a.nome,
      'email',         a.email,
      'telefone',      a.telefone,
      'cep',           a.cep,
      'logradouro',    a.logradouro,
      'numero',        a.numero,
      'complemento',   a.complemento,
      'bairro',        a.bairro,
      'cidade',        a.cidade,
      'uf',            a.uf,
      'data_nascimento', a.data_nascimento
    )
  ) INTO v_result
  FROM public.alunos a
  WHERE a.cpf_hash = p_cpf_hash
  LIMIT 1;

  RETURN COALESCE(v_result, '{"found": false}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.fn_lookup_aluno_por_cpf_hash IS
  'Lookup de aluno por hash SHA-256 do CPF. Nunca expõe o CPF plaintext. Apenas staff pode executar.';

DO $$
DECLARE
  v_alunos_hash   int;
  v_legal_hash    int;
  v_alunos_total  int;
  v_legal_total   int;
BEGIN
  SELECT COUNT(*) INTO v_alunos_total FROM public.alunos WHERE cpf IS NOT NULL AND cpf <> '';
  SELECT COUNT(*) INTO v_alunos_hash  FROM public.alunos WHERE cpf_hash IS NOT NULL;
  SELECT COUNT(*) INTO v_legal_total  FROM public.legal_annexes WHERE cpf IS NOT NULL AND cpf <> '';
  SELECT COUNT(*) INTO v_legal_hash   FROM public.legal_annexes WHERE cpf_hash IS NOT NULL;

  RAISE NOTICE '=== CPF HASH SYNC ===';
  RAISE NOTICE 'alunos: %/% com hash populado', v_alunos_hash, v_alunos_total;
  RAISE NOTICE 'legal_annexes: %/% com hash populado', v_legal_hash, v_legal_total;

  IF v_alunos_hash < v_alunos_total THEN
    RAISE WARNING 'alunos: % registros sem cpf_hash', v_alunos_total - v_alunos_hash;
  END IF;
  IF v_legal_hash < v_legal_total THEN
    RAISE WARNING 'legal_annexes: % registros sem cpf_hash', v_legal_total - v_legal_hash;
  END IF;
END;
$$;