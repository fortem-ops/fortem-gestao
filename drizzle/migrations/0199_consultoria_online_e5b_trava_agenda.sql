-- E5b (Proposta A): insere a recusa 'somente_online' logo após identificar o aluno, nas 2 funções do app.
-- Mesmo texto ensaiado (md5 treino 545c0281..., servico a3e66167...). Assinatura, owner, SECURITY DEFINER,
-- search_path e GRANTs preservados (CREATE OR REPLACE mantém a ACL).
DO $e5b$
DECLARE
  g constant text := E'\n  -- E5b: aluno só com Consultoria Online não agenda pelo app (equipe usa fn_agendar_servico_equipe)\n  IF public.fn_aluno_somente_online(_aluno_id) THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''somente_online'');\n  END IF;\n';
  bt constant text := E'  IF _aluno_id IS NULL THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''nao_autenticado'');\n  END IF;\n';
  bs constant text := E'  IF _aluno_id IS NULL THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''aluno_nao_encontrado'');\n  END IF;\n';
  dt text := pg_get_functiondef('public.fn_agendar_treino(uuid,date)'::regprocedure);
  ds text := pg_get_functiondef('public.fn_agendar_servico(uuid,date)'::regprocedure);
BEGIN
  IF position('somente_online' in dt) > 0 OR position('somente_online' in ds) > 0 THEN
    RAISE EXCEPTION 'E5b: trava já presente';
  END IF;
  IF (length(dt) - length(replace(dt, bt, ''))) / length(bt) <> 1
     OR (length(ds) - length(replace(ds, bs, ''))) / length(bs) <> 1 THEN
    RAISE EXCEPTION 'E5b: ponto de inserção não encontrado exatamente uma vez';
  END IF;
  EXECUTE replace(dt, bt, bt || g);
  EXECUTE replace(ds, bs, bs || g);
  IF md5(pg_get_functiondef('public.fn_agendar_treino(uuid,date)'::regprocedure)) <> '545c028131c4b63f4e2fa372b5c3d629'
     OR md5(pg_get_functiondef('public.fn_agendar_servico(uuid,date)'::regprocedure)) <> 'a3e66167f4a02a6384338912a26a8fd1' THEN
    RAISE EXCEPTION 'E5b: texto final difere do ensaiado';
  END IF;
END $e5b$;