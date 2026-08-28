ALTER TABLE public.exercicio_categorias ADD COLUMN IF NOT EXISTS sigla text;

-- Backfill: siglas históricas dos blocos de aquecimento
UPDATE public.exercicio_categorias SET sigla = 'LIB' WHERE categoria = 'Liberação Miofascial' AND sigla IS NULL;
UPDATE public.exercicio_categorias SET sigla = 'MOB' WHERE categoria = 'Mobilidade Articular' AND sigla IS NULL;
UPDATE public.exercicio_categorias SET sigla = 'ATI' WHERE categoria = 'Ativação Muscular' AND sigla IS NULL;
UPDATE public.exercicio_categorias SET sigla = 'PREV' WHERE categoria = 'Preventivo' AND sigla IS NULL;

-- Demais categorias: sugestão automática (3 primeiras letras sem acento, maiúsculas)
UPDATE public.exercicio_categorias
SET sigla = upper(substring(regexp_replace(translate(categoria,
      'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^A-Za-z0-9]', '', 'g') from 1 for 3))
WHERE sigla IS NULL;

CREATE OR REPLACE FUNCTION public.fn_definir_sigla_categoria(
  p_grupo text,
  p_categoria text,
  p_sigla text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sigla text;
  v_count integer;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar categorias';
  END IF;

  v_sigla := upper(btrim(coalesce(p_sigla, '')));
  IF v_sigla = '' THEN
    RAISE EXCEPTION 'Sigla não pode ser vazia';
  END IF;
  IF v_sigla !~ '^[A-Z0-9_]{2,8}$' THEN
    RAISE EXCEPTION 'Sigla deve ter de 2 a 8 caracteres (letras, números ou _)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.exercicio_categorias
    WHERE grupo = p_grupo AND sigla = v_sigla AND categoria <> p_categoria
  ) THEN
    RAISE EXCEPTION 'Sigla % já usada em outra categoria do grupo %', v_sigla, p_grupo;
  END IF;

  UPDATE public.exercicio_categorias
  SET sigla = v_sigla, updated_at = now()
  WHERE grupo = p_grupo AND categoria = p_categoria;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_definir_sigla_categoria(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_definir_sigla_categoria(text, text, text) TO authenticated;