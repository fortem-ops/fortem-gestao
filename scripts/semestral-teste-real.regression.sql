-- Teste real R$ 1,00 (chave semestral_teste_real): só a aluna da chave vê só o item da chave; ninguém mais muda.
-- Ensaio revertido: termina em ENSAIO_OK. Rodado em 11/11/2026 com sucesso (bloco completo no histórico da Etapa 4C).
DO $t$ DECLARE n int; v text; m int; BEGIN
  SELECT count(*) INTO n FROM alunos a WHERE public.fn_semestral_teste_real(a.id,'pro_semestral_wellhub_3x') IS NOT NULL;
  IF n > 1 THEN RAISE EXCEPTION 'FALHOU: % alunos com a chave', n; END IF;
  SELECT count(*) INTO m FROM alunos a WHERE public.fn_semestral_teste_real(a.id,'pro_semestral_wellhub_3x') IS NULL
     AND EXISTS (SELECT 1 FROM fn_semestral_itens_elegiveis(a.id) c WHERE NOT c.ativo);
  IF m <> 0 THEN RAISE EXCEPTION 'FALHOU: % alunos fora da chave veem item desligado', m; END IF;
  RAISE EXCEPTION 'ENSAIO_OK';
END $t$;
