INSERT INTO public.bodymap_shapes (shape_key, label, view, kind, points)
VALUES
  ('ombro-ri-esquerdo', 'Ombro esquerdo — RI', 'front', 'articulacao', '[[625, 197], [675, 226], [675, 284], [625, 313], [575, 284], [575, 226]]'::jsonb),
  ('ombro-ri-direito', 'Ombro direito — RI', 'front', 'articulacao', '[[400, 197], [450, 226], [450, 284], [400, 313], [350, 284], [350, 226]]'::jsonb),
  ('ombro-re-esquerdo', 'Ombro esquerdo — RE', 'back', 'articulacao', '[[625, 213], [670, 239], [670, 291], [625, 317], [580, 291], [580, 239]]'::jsonb),
  ('ombro-re-direito', 'Ombro direito — RE', 'back', 'articulacao', '[[400, 213], [445, 239], [445, 291], [400, 317], [355, 291], [355, 239]]'::jsonb),
  ('quadril-ri-esquerdo', 'Quadril esquerdo — RI', 'front', 'articulacao', '[[560, 495], [603, 520], [603, 570], [560, 595], [517, 570], [517, 520]]'::jsonb),
  ('quadril-ri-direito', 'Quadril direito — RI', 'front', 'articulacao', '[[465, 495], [508, 520], [508, 570], [465, 595], [422, 570], [422, 520]]'::jsonb),
  ('quadril-re-esquerdo', 'Quadril esquerdo — RE', 'back', 'articulacao', '[[575, 505], [618, 530], [618, 580], [575, 605], [532, 580], [532, 530]]'::jsonb),
  ('quadril-re-direito', 'Quadril direito — RE', 'back', 'articulacao', '[[450, 505], [493, 530], [493, 580], [450, 605], [407, 580], [407, 530]]'::jsonb),
  ('tornozelo-esquerdo', 'Tornozelo esquerdo', 'front', 'articulacao', '[[560, 951], [589, 968], [589, 1002], [560, 1019], [531, 1002], [531, 968]]'::jsonb),
  ('tornozelo-direito', 'Tornozelo direito', 'front', 'articulacao', '[[465, 951], [494, 968], [494, 1002], [465, 1019], [436, 1002], [436, 968]]'::jsonb),
  ('toracica', 'Coluna torácica', 'back', 'articulacao', '[[512, 220], [581, 260], [581, 340], [512, 380], [443, 340], [443, 260]]'::jsonb)
ON CONFLICT (shape_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.exercicio_articulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio_id uuid NOT NULL REFERENCES public.exercicios_personalizados(id) ON DELETE CASCADE,
  articulacao_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (exercicio_id, articulacao_key)
);

CREATE INDEX IF NOT EXISTS idx_exercicio_articulacoes_exercicio
  ON public.exercicio_articulacoes(exercicio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercicio_articulacoes TO authenticated;
GRANT ALL ON public.exercicio_articulacoes TO service_role;

ALTER TABLE public.exercicio_articulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exercicio_articulacoes"
  ON public.exercicio_articulacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin can insert exercicio_articulacoes"
  ON public.exercicio_articulacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can update exercicio_articulacoes"
  ON public.exercicio_articulacoes FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete exercicio_articulacoes"
  ON public.exercicio_articulacoes FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));