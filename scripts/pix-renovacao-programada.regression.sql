-- Execute via ferramenta privilegiada de consultas. Tudo é desfeito; nenhuma API bancária é chamada.
BEGIN;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$
DECLARE b jsonb; r jsonb; antigo uuid:='06ff1222-e351-4d6d-8427-890e2dc9362e';
 aluno uuid:='b6c2981c-c12a-4901-9ade-588922522f33'; grupo uuid:='e51dd61d-45f0-42b2-b90b-c9159952ffb1';
BEGIN
 SELECT jsonb_agg(to_jsonb(c) ORDER BY id) INTO b FROM creditos_aluno c WHERE aluno_id=aluno;
 r:=fn_pix_aut_renovacoes_diario('2026-12-04');
 IF jsonb_array_length(r->'falhas')<>0 THEN RAISE EXCEPTION 'preparacao falhou: %',r; END IF;
 IF NOT (SELECT ativo FROM planos WHERE id=antigo) OR (SELECT status FROM contratos WHERE plano_id=antigo)<>'ativo' THEN
  RAISE EXCEPTION 'REGRESSAO: renovacao D-8 encerrou ciclo atual'; END IF;
 IF (SELECT id FROM fn_plano_principal_ativo(aluno))<>antigo THEN RAISE EXCEPTION 'resolver mudou antes do inicio'; END IF;
 IF EXISTS(SELECT 1 FROM pix_aut_renovacoes x JOIN planos p ON p.id=x.plano_novo_id WHERE x.grupo_id=grupo AND p.ativo)
  OR EXISTS(SELECT 1 FROM pix_aut_renovacoes x JOIN ciclos_credito c ON c.contrato_id=x.contrato_novo_id WHERE x.grupo_id=grupo AND c.status='ativo')
  OR EXISTS(SELECT 1 FROM pix_aut_renovacoes x JOIN creditos_aluno c ON c.origem_id=x.venda_id WHERE x.grupo_id=grupo AND c.ativo)
 THEN RAISE EXCEPTION 'beneficio futuro liberado antes do inicio'; END IF;
 IF b IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM creditos_aluno c WHERE aluno_id=aluno
  AND origem_id NOT IN(SELECT venda_id FROM pix_aut_renovacoes WHERE grupo_id=grupo)) THEN RAISE EXCEPTION 'credito atual mudou'; END IF;
 PERFORM fn_pix_aut_renovacoes_diario('2026-12-08');
 IF NOT (SELECT ativo FROM planos WHERE id=antigo) THEN RAISE EXCEPTION 'plano atual perdeu vigencia em 08/12'; END IF;
 IF (SELECT count(*) FROM pix_aut_renovacoes WHERE grupo_id=grupo)<>2 THEN RAISE EXCEPTION 'duplicou renovacao'; END IF;
 IF (fn_pix_aut_composicao(grupo,'2026-12-12')->>'valor')::numeric<>320 THEN RAISE EXCEPTION 'valor diferente de 320'; END IF;
 IF (SELECT count(*) FROM pix_aut_itens WHERE grupo_id=grupo AND ativo_ate IS NULL)<>2 THEN RAISE EXCEPTION 'duplicou itens'; END IF;
 PERFORM fn_pix_aut_renovacoes_diario('2026-12-12');
 IF EXISTS(SELECT 1 FROM pix_aut_renovacoes x JOIN planos p ON p.id=x.plano_anterior_id WHERE x.grupo_id=grupo AND p.ativo)
 OR EXISTS(SELECT 1 FROM pix_aut_renovacoes x JOIN planos p ON p.id=x.plano_novo_id WHERE x.grupo_id=grupo AND NOT p.ativo)
 THEN RAISE EXCEPTION 'troca na data de inicio falhou'; END IF;
 IF (SELECT status FROM contratos WHERE plano_id=antigo)<>'encerrado' THEN RAISE EXCEPTION 'contrato antigo nao encerrou'; END IF;
 PERFORM fn_pix_aut_renovacoes_diario('2026-12-12');
 IF (SELECT count(*) FROM pix_aut_renovacoes WHERE grupo_id=grupo)<>2 THEN RAISE EXCEPTION 'ativacao duplicou'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"8cdc26f0-c253-47cf-88c6-f7bfffc1c207"}',true);
DO $$ DECLARE r jsonb; BEGIN
 r:=fn_agendar_treino('ce3a980f-9b45-4da6-bb41-527991f063a9','2026-12-14');
 IF (r->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'treino apos ativacao falhou: %',r; END IF;
END $$;
SELECT 'PASS: 04/12 e 08/12 preservados, 12/12 assume; R$320; idempotencia' resultado;
ROLLBACK;
