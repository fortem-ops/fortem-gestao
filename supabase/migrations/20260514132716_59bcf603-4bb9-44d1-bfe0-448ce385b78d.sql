
-- ============================================================
-- FASE 1 — SEGURANÇA: endurecimento de RLS, search_path e ACLs
-- ============================================================

-- 1) CRÍTICO: remover acesso anônimo à tabela alunos
DROP POLICY IF EXISTS "Public can view alunos" ON public.alunos;

-- 2) CRÍTICO: bucket de anexos jurídicos não pode ser legível por anon
--    Mantemos INSERT anon (assinatura pública) mas leitura só para admin.
DROP POLICY IF EXISTS "Anyone read legal annex attachments" ON storage.objects;

CREATE POLICY "Admin can read legal annex attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'legal_annex_attachments' AND public.is_admin(auth.uid()));

-- Bucket deixa de ser público (URLs assinadas serão necessárias para download)
UPDATE storage.buckets SET public = false WHERE id = 'legal_annex_attachments';

-- 3) Restringir upload de anexos jurídicos (anon ainda pode, mas com path-prefix do CPF)
--    Mantemos como está para não quebrar fluxo público de assinatura, mas registramos no security memory.

-- 4) search_path: corrigir a única função que não tinha
CREATE OR REPLACE FUNCTION public.fn_is_auto_renew_plan(_tipo text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
 SET search_path = public
AS $function$
  SELECT _tipo IS NOT NULL AND (
    lower(_tipo) LIKE '%start%'
    OR lower(_tipo) LIKE '%gympass%'
    OR lower(_tipo) LIKE '%wellhub%'
    OR lower(_tipo) LIKE '%total%pass%'
    OR lower(_tipo) LIKE '%totalpass%'
  );
$function$;

-- 5) REVOKE EXECUTE de anon em TODAS as funções SECURITY DEFINER do schema public.
--    Nenhuma função deste app precisa ser chamada sem login.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', r.sig);
  END LOOP;
END $$;
