-- Troca somente a chave de atividade do crédito de bota para casar com agenda_servicos.atividade.
-- Descrições de movimento ('Bota de compressão ciclo…', 'Bota de compressão — …') não mudam.
DO $mig$
DECLARE
  f text;
  def text;
  novo text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.fn_creditos_mensais_2027(date)',
    'public.fn_venda_2027_gravar(jsonb,uuid,boolean,text,text,boolean)'
  ] LOOP
    def := pg_get_functiondef(f::regprocedure);
    novo := replace(def, '''Bota de compressão''', '''Recovery (Bota de Compressão)''');
    IF novo = def THEN
      RAISE EXCEPTION 'Nenhuma ocorrência em %', f;
    END IF;
    EXECUTE novo;
  END LOOP;
END
$mig$;