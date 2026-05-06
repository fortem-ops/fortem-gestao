
CREATE TABLE public.aluno_licencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  plano_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('plano','medica')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias integer NOT NULL,
  motivo text,
  arquivo_url text,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aluno_licencas_aluno ON public.aluno_licencas(aluno_id);
CREATE INDEX idx_aluno_licencas_plano ON public.aluno_licencas(plano_id);

ALTER TABLE public.aluno_licencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view licencas"
  ON public.aluno_licencas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin can insert licencas"
  ON public.aluno_licencas FOR INSERT TO authenticated
  WITH CHECK (is_coordinator_or_admin(auth.uid()) AND criado_por = auth.uid());

CREATE POLICY "Coord/admin can update licencas"
  ON public.aluno_licencas FOR UPDATE TO authenticated
  USING (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete licencas"
  ON public.aluno_licencas FOR DELETE TO authenticated
  USING (is_coordinator_or_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_validate_aluno_licenca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_tipo text;
  v_limite int;
  v_total int;
BEGIN
  IF NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'Data final deve ser maior ou igual à data inicial';
  END IF;

  NEW.dias := (NEW.data_fim - NEW.data_inicio) + 1;
  NEW.updated_at := now();

  SELECT tipo INTO v_plano_tipo FROM public.planos WHERE id = NEW.plano_id;
  IF v_plano_tipo IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  IF NEW.tipo = 'plano' THEN
    v_limite := CASE v_plano_tipo
      WHEN 'Start+' THEN 10
      WHEN 'Power'  THEN 15
      WHEN 'Pro'    THEN 20
      WHEN 'Max'    THEN 30
      ELSE 0
    END;
    IF v_limite = 0 THEN
      RAISE EXCEPTION 'Plano % não permite Licença do Plano', v_plano_tipo;
    END IF;
  ELSE
    IF v_plano_tipo NOT IN ('Start','Start+','Power','Pro','Max') THEN
      RAISE EXCEPTION 'Plano % não permite Licença Médica', v_plano_tipo;
    END IF;
    v_limite := 30;
  END IF;

  SELECT COALESCE(SUM(dias),0) INTO v_total
  FROM public.aluno_licencas
  WHERE plano_id = NEW.plano_id
    AND tipo = NEW.tipo
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_total + NEW.dias > v_limite THEN
    RAISE EXCEPTION 'Limite de % dias para % excedido (já usados: %, solicitados: %)',
      v_limite, NEW.tipo, v_total, NEW.dias;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_aluno_licenca
BEFORE INSERT OR UPDATE ON public.aluno_licencas
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_aluno_licenca();
