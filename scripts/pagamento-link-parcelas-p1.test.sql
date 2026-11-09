-- Ensaio P1: aplica, compara antes×depois e desfaz tudo (exceção final).
-- Impressão digital antes (7 linhas): md5 f4f6a0106937b4a87d22169266af783a
DO $$
DECLARE n0 int; m0 text; n1 int; m1 text; nn int; ok_chk boolean := false;
BEGIN
  SELECT count(*), md5(string_agg(concat_ws('|',id,venda_id,token,criado_por,usado_em),',' ORDER BY id)) INTO n0, m0 FROM public.links_pagamento;
  ALTER TABLE public.links_pagamento ADD COLUMN parcelas_max integer NULL, ADD COLUMN parcelas_fixas boolean NULL;
  ALTER TABLE public.links_pagamento ADD CONSTRAINT links_pagamento_parcelas_max_chk CHECK (parcelas_max IS NULL OR parcelas_max BETWEEN 1 AND 12);
  SELECT count(*), md5(string_agg(concat_ws('|',id,venda_id,token,criado_por,usado_em),',' ORDER BY id)) INTO n1, m1 FROM public.links_pagamento;
  SELECT count(*) INTO nn FROM public.links_pagamento WHERE parcelas_max IS NOT NULL OR parcelas_fixas IS NOT NULL;
  BEGIN
    UPDATE public.links_pagamento SET parcelas_max = 13 WHERE id = (SELECT id FROM public.links_pagamento LIMIT 1);
  EXCEPTION WHEN check_violation THEN ok_chk := true;
  END;
  RAISE EXCEPTION 'ENSAIO antes=% % depois=% % iguais=% novas_nao_nulas=% check13_recusado=%', n0, m0, n1, m1, (n0=n1 AND m0=m1), nn, ok_chk;
END $$;
