-- Allow public (anon) read access to treinos so the QR code in the printed PDF
-- works without login. Authenticated policies remain unchanged.
CREATE POLICY "Public can view treinos"
ON public.treinos
FOR SELECT
TO anon
USING (true);

-- Allow public (anon) read access to alunos so the public workout page can
-- display the student's name in the header.
CREATE POLICY "Public can view alunos"
ON public.alunos
FOR SELECT
TO anon
USING (true);