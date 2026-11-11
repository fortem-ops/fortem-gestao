-- Correção do teste real de 11/11: venda Semestral de teste (teste_2027) segue o caminho de balcão
-- (1ª mensalidade, ativação, mensalidades seguintes); vendas de teste não contam para o CPF.
CREATE OR REPLACE FUNCTION public.fn_venda_balcao_recorrente(p_origem text, p_catalogo uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT p_origem = 'manual'
      OR (p_origem = 'teste_2027' AND EXISTS (SELECT 1 FROM public.planos_catalogo WHERE id = p_catalogo AND familia = 'semestral_2027'));
$f$;
REVOKE ALL ON FUNCTION public.fn_venda_balcao_recorrente(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_venda_balcao_recorrente(text, uuid) TO service_role;

DO $m$
DECLARE d text; f text; a text; b text;
BEGIN
  FOR f, a, b IN VALUES
    ('public.fn_manual_primeiro_ciclo_reservar(uuid,text,text,uuid,uuid)', 'v.origem IS DISTINCT FROM ''manual''', 'NOT COALESCE(public.fn_venda_balcao_recorrente(v.origem, v.catalogo_id), false)'),
    ('public.fn_manual_primeiro_ciclo_liquidar(uuid,uuid,jsonb)', 'v.origem IS DISTINCT FROM ''manual''', 'NOT COALESCE(public.fn_venda_balcao_recorrente(v.origem, v.catalogo_id), false)'),
    ('public.fn_mensalidade_manual_gerar(uuid)', 'v.origem IS DISTINCT FROM ''manual''', 'NOT COALESCE(public.fn_venda_balcao_recorrente(v.origem, v.catalogo_id), false)'),
    ('public.fn_mensalidade_manual_cobravel(uuid)', 'v.origem = ''manual''', 'public.fn_venda_balcao_recorrente(v.origem, v.catalogo_id)'),
    ('public.fn_semestral_elegivel(uuid,text,date,boolean)', '         AND public.fn_semestral_venda_paga(v.id)', '         AND public.fn_semestral_venda_paga(v.id)
         AND v.origem IS DISTINCT FROM ''teste_2027''')
  LOOP
    d := pg_get_functiondef(f::regprocedure);
    IF (length(d) - length(replace(d, a, ''))) / length(a) <> 1 THEN
      RAISE EXCEPTION 'Trecho esperado não encontrado uma única vez em %', f;
    END IF;
    EXECUTE replace(d, a, b);
  END LOOP;
END $m$;