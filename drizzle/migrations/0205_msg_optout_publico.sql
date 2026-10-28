CREATE TABLE public.msg_optout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL CHECK (canal IN ('email','whatsapp')),
  email_norm text,
  telefone_norm text,
  aluno_id uuid,
  motivo text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','link')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid DEFAULT auth.uid(),
  CONSTRAINT msg_optout_contato_ck CHECK (
    (canal = 'email' AND email_norm IS NOT NULL AND email_norm <> '') OR
    (canal = 'whatsapp' AND telefone_norm IS NOT NULL AND telefone_norm <> ''))
);
CREATE UNIQUE INDEX msg_optout_email_uq ON public.msg_optout (canal, email_norm) WHERE canal = 'email';
CREATE UNIQUE INDEX msg_optout_tel_uq ON public.msg_optout (canal, telefone_norm) WHERE canal = 'whatsapp';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_optout TO authenticated;
GRANT ALL ON public.msg_optout TO service_role;
ALTER TABLE public.msg_optout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_optout admin select" ON public.msg_optout FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_optout admin insert" ON public.msg_optout FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_optout admin update" ON public.msg_optout FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_optout admin delete" ON public.msg_optout FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Mesma regra de normalizarTelefone (supabase/functions/_shared/whatsapp.ts)
CREATE OR REPLACE FUNCTION public.fn_msg_norm_tel(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p IS NULL OR p = '' THEN NULL
    WHEN regexp_replace(p,'\D','','g') LIKE '55%' AND length(regexp_replace(p,'\D','','g')) >= 12 THEN regexp_replace(p,'\D','','g')
    WHEN length(regexp_replace(p,'\D','','g')) >= 10 THEN '55' || regexp_replace(p,'\D','','g')
    ELSE regexp_replace(p,'\D','','g') END
$$;

CREATE OR REPLACE FUNCTION public.fn_msg_publico(
  p_status text[], p_busca text, p_canal text, p_excl_confirmados boolean, p_excl_sem_contato boolean,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'acesso negado'; END IF;
  WITH base AS (
    SELECT a.id, a.nome, a.status, a.is_equipe,
      NULLIF(lower(trim(a.email)),'') AS email,
      public.fn_msg_norm_tel(a.telefone) AS tel
    FROM alunos a
    WHERE a.status = ANY(p_status)
      AND (coalesce(trim(p_busca),'') = '' OR a.nome ILIKE '%'||trim(p_busca)||'%' OR a.email ILIKE '%'||trim(p_busca)||'%'
           OR (length(regexp_replace(p_busca,'\D','','g')) >= 3 AND regexp_replace(coalesce(a.telefone,''),'\D','','g') LIKE '%'||regexp_replace(p_busca,'\D','','g')||'%'))
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
    'rows', coalesce((SELECT jsonb_agg(r) FROM (SELECT id, nome, status, tem_email, tem_whats, motivo FROM m
              ORDER BY nome LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(0,p_offset)) r), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.fn_msg_publico(text[],text,text,boolean,boolean,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_msg_publico(text[],text,text,boolean,boolean,integer,integer) TO authenticated, service_role;