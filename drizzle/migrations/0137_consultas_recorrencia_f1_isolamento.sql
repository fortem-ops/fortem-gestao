DO $patch$
DECLARE s text; nome text; alvo regprocedure;
BEGIN
 FOREACH nome IN ARRAY ARRAY['fn_checkout_2027_cartao_liquidado','fn_checkout_2027_tentativa_atualizar'] LOOP
  SELECT oid::regprocedure INTO alvo FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=nome;
  SELECT pg_get_functiondef(alvo) INTO s;
  IF position('BEGIN' IN s)=0 THEN RAISE EXCEPTION 'Definição de baixa mudou'; END IF;
  s:=regexp_replace(s,'BEGIN','BEGIN'||chr(10)||'  IF EXISTS (SELECT 1 FROM public.checkout_2027_tentativas WHERE id=p_tentativa_id AND finalidade=''consultas'') THEN RAISE EXCEPTION ''Baixa global não aceita consultas''; END IF;');
  EXECUTE s;
 END LOOP;
END $patch$;
