-- E5b ROLLBACK (Proposta A, migração 0199): remove a trava 'somente_online' das 2 funções do app.
-- Restaura exatamente o texto de consultoria-online-e5b.antes.sql (md5 conferido no fim).
-- Assinatura, owner, SECURITY DEFINER, search_path e GRANTs ficam como estão (CREATE OR REPLACE mantém a ACL).
-- Rodar como migração (o texto completo das funções não pode ir na migração por citar o cofre).
DO $e5b_rb$
DECLARE
  g constant text := E'\n  -- E5b: aluno só com Consultoria Online não agenda pelo app (equipe usa fn_agendar_servico_equipe)\n  IF public.fn_aluno_somente_online(_aluno_id) THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''somente_online'');\n  END IF;\n';
  dt text := pg_get_functiondef('public.fn_agendar_treino(uuid,date)'::regprocedure);
  ds text := pg_get_functiondef('public.fn_agendar_servico(uuid,date)'::regprocedure);
BEGIN
  IF position(g in dt) = 0 OR position(g in ds) = 0 THEN
    RAISE EXCEPTION 'E5b rollback: trava não encontrada';
  END IF;
  EXECUTE replace(dt, g, '');
  EXECUTE replace(ds, g, '');
  IF md5(pg_get_functiondef('public.fn_agendar_treino(uuid,date)'::regprocedure)) <> '78923bf40cb4d57ac9a415d817c2ebfc'
     OR md5(pg_get_functiondef('public.fn_agendar_servico(uuid,date)'::regprocedure)) <> '5f7da1b69bf6fdd9ffa2ac412eb8bfa7' THEN
    RAISE EXCEPTION 'E5b rollback: texto restaurado difere do antes';
  END IF;
END $e5b_rb$;
