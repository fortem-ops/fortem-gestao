-- Corrige mapeamento plano → nível do Clube FORTEM para usar os tipos
-- reais cadastrados no perfil do aluno (Start, Start+, Power, Pro, Max).
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

  -- Sem plano ativo → START padrão
  IF _tipo IS NULL THEN
    RETURN jsonb_build_object('nivel', 'start', 'status', 'ativo');
  END IF;

  -- Planos agregadores não recebem benefícios
  IF _tipo IN ('Gympass/Wellhub', 'Total Pass') THEN
    RETURN jsonb_build_object('nivel', 'start', 'status', 'bloqueado');
  END IF;

  -- Mapeamento direto pelo tipo do plano cadastrado
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

-- Re-sincroniza todos os membros existentes com o novo mapeamento
DO $$
DECLARE
  _aluno record;
BEGIN
  FOR _aluno IN SELECT id FROM public.alunos LOOP
    PERFORM public.fn_clube_sync_membro(_aluno.id);
  END LOOP;
END $$;