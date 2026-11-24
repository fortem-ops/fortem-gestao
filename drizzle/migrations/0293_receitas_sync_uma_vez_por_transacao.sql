-- Sincronização de receitas: uma vez por transação, adiada para o commit.
--
-- Antes: gatilho por comando em cobrancas. Cada comando reconstruía a
-- tabela receitas inteira (1330 ms na 1ª chamada da transação, 349 ms nas
-- seguintes). Uma venda 2027 em 12x roda 13 comandos e estourava o
-- statement_timeout de 8 s.
--
-- Agora: CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED. O Postgres exige
-- que constraint triggers sejam FOR EACH ROW, então a função usa uma trava
-- local à transação para fazer o trabalho uma única vez. Como a reconstrução
-- é completa, rodar uma vez no fim produz exatamente o mesmo resultado que
-- rodar N vezes, e sai do orçamento de tempo do comando.

CREATE OR REPLACE FUNCTION public.trg_cobrancas_sync_receitas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Trava local à transação (3º argumento `true` em set_config): a primeira
  -- linha disparada faz a sincronização, as demais saem na hora.
  IF COALESCE(current_setting('fortem.receitas_sync_feito', true), '') = '1' THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('fortem.receitas_sync_feito', '1', true);
  PERFORM public.fn_receitas_sync_automaticas();
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_cobrancas_sync_receitas ON public.cobrancas;

CREATE CONSTRAINT TRIGGER trg_cobrancas_sync_receitas
AFTER INSERT OR UPDATE OR DELETE ON public.cobrancas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_cobrancas_sync_receitas();