ALTER TABLE public.rate_limit_fotos_publico ADD COLUMN IF NOT EXISTS ref uuid, ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS rate_limit_fotos_publico_ref_idx ON public.rate_limit_fotos_publico (ref);

CREATE OR REPLACE FUNCTION public.fn_fotos_limite(p_chaves text[], p_limites integer[], p_acao text, p_ref uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i int; n int; v_fim timestamptz; v_espera int := 0;
BEGIN
  IF array_length(p_chaves,1) IS DISTINCT FROM array_length(p_limites,1) THEN RAISE EXCEPTION 'parametros'; END IF;
  FOR i IN 1..array_length(p_chaves,1) LOOP
    PERFORM pg_advisory_xact_lock(hashtext('fotos_rl:' || p_chaves[i] || ':' || p_acao));
  END LOOP;
  DELETE FROM public.rate_limit_fotos_publico WHERE criado_em < now() - interval '2 hours';
  FOR i IN 1..array_length(p_chaves,1) LOOP
    WITH v AS (
      SELECT CASE WHEN concluido THEN criado_em + interval '1 hour' ELSE criado_em + interval '15 minutes' END AS expira
        FROM public.rate_limit_fotos_publico WHERE ip_hash = p_chaves[i] AND acao = p_acao
    ) SELECT count(*) FILTER (WHERE expira > now()) INTO n FROM v;
    IF n >= p_limites[i] THEN
      SELECT expira INTO v_fim FROM (
        SELECT CASE WHEN concluido THEN criado_em + interval '1 hour' ELSE criado_em + interval '15 minutes' END AS expira
          FROM public.rate_limit_fotos_publico WHERE ip_hash = p_chaves[i] AND acao = p_acao) x
       WHERE expira > now() ORDER BY expira OFFSET (n - p_limites[i]) LIMIT 1;
      v_espera := greatest(v_espera, greatest(1, ceil(extract(epoch FROM (v_fim - now())) / 60)::int));
    END IF;
  END LOOP;
  IF v_espera > 0 THEN RETURN jsonb_build_object('ok', false, 'minutos', v_espera); END IF;
  FOR i IN 1..array_length(p_chaves,1) LOOP
    INSERT INTO public.rate_limit_fotos_publico (ip_hash, acao, ref, concluido) VALUES (p_chaves[i], p_acao, p_ref, p_ref IS NULL);
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_fotos_limite_concluir(p_ref uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.rate_limit_fotos_publico SET concluido = true, criado_em = now() WHERE ref = p_ref AND NOT concluido;
$$;
REVOKE ALL ON FUNCTION public.fn_fotos_limite(text[], integer[], text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fotos_limite_concluir(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fotos_limite(text[], integer[], text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fotos_limite_concluir(uuid) TO service_role;

DELETE FROM public.rate_limit_fotos_publico WHERE acao IN ('envio','busca');