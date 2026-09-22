-- exercicios-videos: leitura apenas para staff ou alunos vinculados
DROP POLICY IF EXISTS "Authenticated can view exercicio videos" ON storage.objects;
CREATE POLICY "Staff/aluno can view exercicio videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exercicios-videos' AND public.is_staff_or_aluno());

-- loja-produtos: bucket privado servido por URLs assinadas; leitura direta
-- limitada a staff e alunos autenticados (visitantes continuam usando a URL assinada)
DROP POLICY IF EXISTS "Loja produtos imagens leitura publica" ON storage.objects;
CREATE POLICY "Loja produtos imagens leitura interna" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'loja-produtos' AND public.is_staff_or_aluno());
