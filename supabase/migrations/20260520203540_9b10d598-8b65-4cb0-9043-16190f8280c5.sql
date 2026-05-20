CREATE TABLE public.avaliacao_pliometria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  avaliacao_id uuid NOT NULL UNIQUE REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  salto_vertical numeric,
  salto_horizontal numeric,
  rsi numeric,
  tempo_contato numeric,
  potencia numeric,
  stiffness numeric,
  assimetria numeric,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacao_pliometria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view avaliacao_pliometria"
ON public.avaliacao_pliometria FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert avaliacao_pliometria"
ON public.avaliacao_pliometria FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.avaliacoes
    WHERE avaliacoes.id = avaliacao_pliometria.avaliacao_id
      AND avaliacoes.avaliador_id = auth.uid()
  )) OR is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "Coord/admin can update avaliacao_pliometria"
ON public.avaliacao_pliometria FOR UPDATE
TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin can delete avaliacao_pliometria"
ON public.avaliacao_pliometria FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));