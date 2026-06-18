-- Defense-in-depth: explicitly deny direct INSERTs into legal_annexes from anon/authenticated.
-- Inserts are only allowed via the submit-legal-annex edge function (service role bypasses RLS).
CREATE POLICY "Block direct inserts on legal_annexes"
ON public.legal_annexes
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);