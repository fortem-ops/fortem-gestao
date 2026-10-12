-- A Bota de cada ciclo usa a mesma venda como origem; o índice "um crédito ativo por venda/atividade"
-- exige encerrar (ativo=false) a Bota do ciclo anterior, já vencida, antes de liberar a do novo ciclo (sem acúmulo).
DO $do$
DECLARE src text; a text; b text;
BEGIN
  SELECT pg_get_functiondef('public.fn_creditos_mensais_2027(date)'::regprocedure) INTO src;
  a := 'v_valid := (r.data_inicio + make_interval(months => v_i + 1) - interval ''1 day'')::date;';
  b := a || '
    UPDATE public.creditos_aluno SET ativo = false
    WHERE origem_id = r.venda_id AND atividade = ''Bota de compressão'' AND ativo AND competencia < v_comp;';
  IF position(a IN src) = 0 THEN RAISE EXCEPTION 'trecho não encontrado'; END IF;
  EXECUTE replace(src, a, b);
END
$do$;