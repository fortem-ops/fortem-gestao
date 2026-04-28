-- 1) Adiciona valor ao enum
ALTER TYPE public.clube_nivel_membro ADD VALUE IF NOT EXISTS 'agregador';

-- 2) Atualiza função de mapeamento plano -> nível
CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tipo text;
  _nivel public.clube_nivel_membro;
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
    RETURN jsonb_build_object('nivel', 'agregador', 'status', 'ativo');
  END IF;

  _nivel := CASE _tipo
    WHEN 'Start'   THEN 'start'::public.clube_nivel_membro
    WHEN 'Start+'  THEN 'start_plus'::public.clube_nivel_membro
    WHEN 'Power'   THEN 'power'::public.clube_nivel_membro
    WHEN 'Pro'     THEN 'pro'::public.clube_nivel_membro
    WHEN 'Max'     THEN 'max'::public.clube_nivel_membro
    ELSE 'start'::public.clube_nivel_membro
  END;

  RETURN jsonb_build_object('nivel', _nivel, 'status', 'ativo');
END $function$;