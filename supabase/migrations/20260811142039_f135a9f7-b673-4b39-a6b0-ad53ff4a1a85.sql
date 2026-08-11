CREATE TABLE public.corrida_campanha_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  rota text,
  tier text,
  nivel text,
  prova_nome text,
  distancia text,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  isento boolean NOT NULL DEFAULT false,
  condicao text,
  valido_ate date NOT NULL DEFAULT '2026-08-20',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT corrida_campanha_itens_tipo_chk CHECK (tipo IN ('kit_fortem','mipoa','cortesia_nb','avaliacao_funcional','prova_avulsa')),
  CONSTRAINT corrida_campanha_itens_rota_chk CHECK (rota IS NULL OR rota IN ('aluno','prospect','somente_provas','ambos')),
  CONSTRAINT corrida_campanha_itens_tier_chk CHECK (tier IS NULL OR tier IN ('prospect','somente_corrida','start','start_plus','power','pro','max','somente_provas')),
  CONSTRAINT corrida_campanha_itens_nivel_chk CHECK (nivel IS NULL OR nivel IN ('kit_1','kit_2','kit_3')),
  CONSTRAINT corrida_campanha_itens_prova_chk CHECK (prova_nome IS NULL OR prova_nome IN ('NB','MIPOA')),
  CONSTRAINT corrida_campanha_itens_dist_chk CHECK (distancia IS NULL OR distancia IN ('5K','10K','21K','42K'))
);

GRANT SELECT ON public.corrida_campanha_itens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrida_campanha_itens TO authenticated;
GRANT ALL ON public.corrida_campanha_itens TO service_role;

ALTER TABLE public.corrida_campanha_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrida_campanha_itens_public_select"
ON public.corrida_campanha_itens FOR SELECT
TO anon, authenticated
USING (ativo = true AND valido_ate >= current_date);

CREATE POLICY "corrida_campanha_itens_staff_all"
ON public.corrida_campanha_itens FOR ALL
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE TRIGGER update_corrida_campanha_itens_updated_at
BEFORE UPDATE ON public.corrida_campanha_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();