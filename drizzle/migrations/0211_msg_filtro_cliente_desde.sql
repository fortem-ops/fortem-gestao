-- 0211: filtro "Cliente desde (de/até)" no Público do Disparo de Mensagens.
-- Data efetiva = a MAIS ANTIGA entre o menor planos.data_inicio (todos os planos) e alunos.aluno_desde.
-- Com algum limite preenchido, quem não tem data efetiva fica fora; intervalo inclusivo.
CREATE OR REPLACE FUNCTION public.fn_cliente_desde(p_aluno uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT least((SELECT min(p.data_inicio)::date FROM planos p WHERE p.aluno_id = p_aluno),
               (SELECT a.aluno_desde FROM alunos a WHERE a.id = p_aluno))
$$;
REVOKE ALL ON FUNCTION public.fn_cliente_desde(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cliente_desde(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.fn_msg_publico(text[], text, text, boolean, boolean, integer, integer);
CREATE FUNCTION public.fn_msg_publico(p_status text[], p_busca text, p_canal text, p_excl_confirmados boolean, p_excl_sem_contato boolean, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_desde_de date DEFAULT NULL, p_desde_ate date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'acesso negado'; END IF;
  WITH pl AS (
    SELECT p.aluno_id, min(p.data_inicio)::date AS d FROM planos p GROUP BY p.aluno_id
  ), base AS (
    SELECT a.id, a.nome, a.status, a.is_equipe,
      NULLIF(lower(trim(a.email)),'') AS email,
      public.fn_msg_norm_tel(a.telefone) AS tel,
      least(pl.d, a.aluno_desde) AS cliente_desde
    FROM alunos a LEFT JOIN pl ON pl.aluno_id = a.id
    WHERE a.status = ANY(p_status)
      AND (coalesce(trim(p_busca),'') = '' OR a.nome ILIKE '%'||trim(p_busca)||'%' OR a.email ILIKE '%'||trim(p_busca)||'%'
           OR (length(regexp_replace(p_busca,'\D','','g')) >= 3 AND regexp_replace(coalesce(a.telefone,''),'\D','','g') LIKE '%'||regexp_replace(p_busca,'\D','','g')||'%'))
      AND (p_desde_de IS NULL OR least(pl.d, a.aluno_desde) >= p_desde_de)
      AND (p_desde_ate IS NULL OR least(pl.d, a.aluno_desde) <= p_desde_ate)
  ), conf AS (
    SELECT DISTINCT public.fn_msg_norm_tel(whatsapp) t FROM festa_confirmacoes WHERE whatsapp IS NOT NULL
  ), m AS (
    SELECT b.*, (b.email IS NOT NULL) AS tem_email, (length(coalesce(b.tel,'')) >= 12) AS tem_whats,
      CASE
        WHEN b.is_equipe THEN 'equipe'
        WHEN EXISTS (SELECT 1 FROM msg_optout o WHERE o.canal = p_canal AND (o.aluno_id = b.id
              OR (p_canal='email' AND o.email_norm = b.email) OR (p_canal='whatsapp' AND o.telefone_norm = b.tel))) THEN 'optout'
        WHEN p_excl_confirmados AND length(coalesce(b.tel,'')) >= 12 AND b.tel IN (SELECT t FROM conf) THEN 'confirmou'
        WHEN p_excl_sem_contato AND ((p_canal='email' AND b.email IS NULL) OR (p_canal='whatsapp' AND length(coalesce(b.tel,'')) < 12)) THEN 'sem_contato'
      END AS motivo
    FROM base b
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM m),
    'com_email', (SELECT count(*) FROM m WHERE tem_email),
    'com_whats', (SELECT count(*) FROM m WHERE tem_whats),
    'elegiveis', (SELECT count(*) FROM m WHERE motivo IS NULL),
    'excl_equipe', (SELECT count(*) FROM m WHERE motivo='equipe'),
    'excl_optout', (SELECT count(*) FROM m WHERE motivo='optout'),
    'excl_confirmou', (SELECT count(*) FROM m WHERE motivo='confirmou'),
    'excl_sem_contato', (SELECT count(*) FROM m WHERE motivo='sem_contato'),
    'rows', coalesce((SELECT jsonb_agg(r) FROM (SELECT id, nome, status, tem_email, tem_whats, motivo, cliente_desde FROM m
              ORDER BY nome LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(0,p_offset)) r), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $function$;
REVOKE ALL ON FUNCTION public.fn_msg_publico(text[], text, text, boolean, boolean, integer, integer, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_msg_publico(text[], text, text, boolean, boolean, integer, integer, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_msg_destinatarios(p_filtro jsonb, p_selecao jsonb)
 RETURNS TABLE(aluno_id uuid, nome text, telefone_norm text, status text, duplicado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text[];
  v_busca text := coalesce(trim(p_filtro->>'busca'),'');
  v_conf boolean := coalesce((p_filtro->>'exclConfirmados')::boolean, true);
  v_sem boolean := coalesce((p_filtro->>'exclSemContato')::boolean, true);
  v_de date := NULLIF(p_filtro->>'clienteDesdeDe','')::date;
  v_ate date := NULLIF(p_filtro->>'clienteDesdeAte','')::date;
  v_modo text := coalesce(p_selecao->>'modo','ids');
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT s), '{}') INTO v_status FROM (
    SELECT unnest(CASE c WHEN 'ativos' THEN ARRAY['ativo'] WHEN 'ex_alunos' THEN ARRAY['inativo','cancelado']
      WHEN 'leads' THEN ARRAY['lead'] WHEN 'prospects' THEN ARRAY['prospect'] WHEN 'avulsos' THEN ARRAY['avulso'] ELSE ARRAY[]::text[] END) s
    FROM jsonb_array_elements_text(coalesce(p_filtro->'chips','[]'::jsonb)) c) x;
  SELECT coalesce(array_agg(e::uuid), '{}') INTO v_ids FROM jsonb_array_elements_text(
    CASE WHEN v_modo = 'todos' THEN coalesce(p_selecao->'removidos','[]'::jsonb) ELSE coalesce(p_selecao->'ids','[]'::jsonb) END) e;

  RETURN QUERY
  WITH pl AS (
    SELECT p.aluno_id, min(p.data_inicio)::date AS d FROM planos p
    WHERE v_de IS NOT NULL OR v_ate IS NOT NULL GROUP BY p.aluno_id
  ), base AS (
    SELECT a.id, a.nome, a.status, a.is_equipe, public.fn_msg_norm_tel(a.telefone) AS tel
    FROM alunos a LEFT JOIN pl ON pl.aluno_id = a.id
    WHERE a.status = ANY(v_status)
      AND (v_busca = '' OR a.nome ILIKE '%'||v_busca||'%' OR a.email ILIKE '%'||v_busca||'%'
           OR (length(regexp_replace(v_busca,'\D','','g')) >= 3 AND regexp_replace(coalesce(a.telefone,''),'\D','','g') LIKE '%'||regexp_replace(v_busca,'\D','','g')||'%'))
      AND (v_de IS NULL OR least(pl.d, a.aluno_desde) >= v_de)
      AND (v_ate IS NULL OR least(pl.d, a.aluno_desde) <= v_ate)
  ), conf AS (
    SELECT DISTINCT public.fn_msg_norm_tel(whatsapp) t FROM festa_confirmacoes WHERE whatsapp IS NOT NULL
  ), m AS (
    SELECT b.*, CASE
        WHEN b.is_equipe THEN 'equipe'
        WHEN EXISTS (SELECT 1 FROM msg_optout o WHERE o.canal = 'whatsapp' AND (o.aluno_id = b.id OR o.telefone_norm = b.tel)) THEN 'optout'
        WHEN v_conf AND length(coalesce(b.tel,'')) >= 12 AND b.tel IN (SELECT t FROM conf) THEN 'confirmou'
        WHEN v_sem AND length(coalesce(b.tel,'')) < 12 THEN 'sem_contato'
      END AS motivo
    FROM base b
  ), sel AS (
    SELECT m.* FROM m
    WHERE m.motivo IS NULL AND length(coalesce(m.tel,'')) >= 12
      AND CASE WHEN v_modo = 'todos' THEN NOT (m.id = ANY(v_ids)) ELSE m.id = ANY(v_ids) END
  )
  SELECT s.id, s.nome, s.tel, s.status,
    (row_number() OVER (PARTITION BY s.tel ORDER BY s.nome, s.id)) > 1
  FROM sel s ORDER BY s.nome, s.id;
END $function$;
REVOKE ALL ON FUNCTION public.fn_msg_destinatarios(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_msg_destinatarios(jsonb, jsonb) TO service_role;
