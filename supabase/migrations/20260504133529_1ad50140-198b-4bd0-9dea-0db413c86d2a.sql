
-- 1) Tabela
CREATE TABLE public.exercicio_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo TEXT NOT NULL,
  subcategoria TEXT NOT NULL,
  ordem_grupo INTEGER NOT NULL DEFAULT 0,
  ordem_sub INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercicio_categorias_unique UNIQUE (grupo, subcategoria)
);

CREATE INDEX idx_exercicio_categorias_grupo ON public.exercicio_categorias (grupo);

-- 2) Trigger updated_at
CREATE TRIGGER update_exercicio_categorias_updated_at
BEFORE UPDATE ON public.exercicio_categorias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RLS
ALTER TABLE public.exercicio_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exercicio_categorias"
ON public.exercicio_categorias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin can insert exercicio_categorias"
ON public.exercicio_categorias FOR INSERT TO authenticated
WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can update exercicio_categorias"
ON public.exercicio_categorias FOR UPDATE TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete exercicio_categorias"
ON public.exercicio_categorias FOR DELETE TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()));

-- 4) Seed (taxonomia atual)
WITH data(grupo, ordem_grupo, subs) AS (
  VALUES
    ('Liberação Miofascial', 10, ARRAY['Pé/Tornozelo','Perna','Joelho/Coxa','Quadril','Lombar','Torácica','Ombro/Escápula','Cervical','Cotovelo/Punho']),
    ('Mobilidade Articular', 20, ARRAY['Pé/Tornozelo','Joelho','Quadril','Quadril RE','Quadril RI','Flexibilidade Posterior MI','Flexibilidade Anterior MI','Torácica','Torácica Rotação','Glenoumeral','Glenoumeral RE','Glenoumeral RI','Cotovelo/Punho','Padrão Geral']),
    ('Ativação Muscular', 30, ARRAY['Pé/Tornozelo','Perna','Estabilidade de Joelho','Quadril','Estabilidade Lombar PA','Estabilidade Lombar PP','Torácica','Ombro/Escápula','Cotovelo/Punho','Padrão Geral','Estabilidade Escapular','Desassociação Lombar/Quadril','Extensão Torácica','Kettlebell','Barra','LPO','Pliométrico','Coordenativo Corrida','Solo']),
    ('Preventivo', 40, ARRAY['Tornozelo','Joelho','Quadril-Glúteos','Quadril-Isquios','Quadril-Flexores','Cotovelo','Ombro']),
    ('Força', 50, ARRAY['Anti-Rotação','Rotação','Anti-Hiperextensão','Anti-flexão','Estabilidade Posterior','Dominante de Joelho Simétrico','Dominante de Joelhos Assimétrico','Dominante de Quadril','Dominante de Quadril Posterior','Empurrar Horizontal','Empurrar Vertical','Puxar Horizontal','Puxar Vertical','Auxiliares','Estabilidade Escapular','Extensão Torácica','Pliometria','Abdominais','Kettlebell','Isoinercial','LPO','Coordenativo Corrida']),
    ('Cardio', 60, ARRAY['Cardio'])
)
INSERT INTO public.exercicio_categorias (grupo, subcategoria, ordem_grupo, ordem_sub)
SELECT d.grupo, s.sub, d.ordem_grupo, (s.idx * 10)::int
FROM data d, LATERAL unnest(d.subs) WITH ORDINALITY AS s(sub, idx)
ON CONFLICT (grupo, subcategoria) DO NOTHING;

-- 5) Função para renomear grupo/subcategoria propagando para exercicios_personalizados
CREATE OR REPLACE FUNCTION public.rename_exercicio_categoria(
  p_old_grupo TEXT,
  p_new_grupo TEXT,
  p_old_sub TEXT DEFAULT NULL,
  p_new_sub TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_old_sub IS NULL THEN
    -- Renomeia grupo inteiro
    UPDATE public.exercicio_categorias
       SET grupo = p_new_grupo, updated_at = now()
     WHERE grupo = p_old_grupo;

    UPDATE public.exercicios_personalizados
       SET grupos = (
         SELECT jsonb_agg(
           CASE WHEN g->>'grupo' = p_old_grupo
                THEN jsonb_set(g, '{grupo}', to_jsonb(p_new_grupo))
                ELSE g END
         )
         FROM jsonb_array_elements(grupos) g
       ),
       updated_at = now()
     WHERE grupos @> jsonb_build_array(jsonb_build_object('grupo', p_old_grupo));
  ELSE
    -- Renomeia subcategoria dentro de um grupo
    UPDATE public.exercicio_categorias
       SET subcategoria = p_new_sub, updated_at = now()
     WHERE grupo = p_old_grupo AND subcategoria = p_old_sub;

    UPDATE public.exercicios_personalizados
       SET grupos = (
         SELECT jsonb_agg(
           CASE WHEN g->>'grupo' = p_old_grupo AND g->>'subcategoria' = p_old_sub
                THEN jsonb_set(g, '{subcategoria}', to_jsonb(p_new_sub))
                ELSE g END
         )
         FROM jsonb_array_elements(grupos) g
       ),
       updated_at = now()
     WHERE grupos @> jsonb_build_array(jsonb_build_object('grupo', p_old_grupo, 'subcategoria', p_old_sub));
  END IF;
END;
$$;
