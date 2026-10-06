DROP POLICY festa_confirmacoes_admin_delete ON public.festa_confirmacoes;

CREATE POLICY festa_confirmacoes_staff_delete
ON public.festa_confirmacoes
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

REVOKE INSERT ON public.festa_confirmacoes FROM anon;
GRANT INSERT (nome, whatsapp, email, vinculo, acompanhantes, total_pessoas) ON public.festa_confirmacoes TO anon;