
-- 1. Add CPF column to alunos (for matching)
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS cpf text;
CREATE UNIQUE INDEX IF NOT EXISTS alunos_cpf_unique_idx
  ON public.alunos (regexp_replace(cpf, '[^0-9]', '', 'g'))
  WHERE cpf IS NOT NULL AND cpf <> '';

-- 2. legal_annexes table
CREATE TABLE public.legal_annexes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL DEFAULT 'anexo',
  nome text NOT NULL,
  data_nascimento date,
  cpf text NOT NULL,
  telefone text,
  email text NOT NULL,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_status text NOT NULL,
  image_usage boolean NOT NULL DEFAULT false,
  signature_data text,
  attachment_url text,
  ip_address text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX legal_annexes_cpf_idx ON public.legal_annexes (cpf);
CREATE INDEX legal_annexes_aluno_id_idx ON public.legal_annexes (aluno_id);
CREATE INDEX legal_annexes_signed_at_idx ON public.legal_annexes (signed_at DESC);

-- 3. Validation trigger (no CHECK constraints)
CREATE OR REPLACE FUNCTION public.fn_legal_annex_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.medical_status NOT IN ('ok', 'restricao') THEN
    RAISE EXCEPTION 'medical_status inválido: %', NEW.medical_status;
  END IF;
  IF NEW.document_type NOT IN ('anexo', 'experimental') THEN
    RAISE EXCEPTION 'document_type inválido: %', NEW.document_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_legal_annex_validate
BEFORE INSERT OR UPDATE ON public.legal_annexes
FOR EACH ROW EXECUTE FUNCTION public.fn_legal_annex_validate();

-- 4. Auto-link to aluno by CPF
CREATE OR REPLACE FUNCTION public.fn_legal_annex_link_aluno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _digits text;
  _aluno_id uuid;
BEGIN
  _digits := regexp_replace(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g');
  IF length(_digits) = 11 THEN
    SELECT id INTO _aluno_id
    FROM public.alunos
    WHERE regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = _digits
    LIMIT 1;
    IF _aluno_id IS NOT NULL THEN
      NEW.aluno_id := _aluno_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_legal_annex_link_aluno
BEFORE INSERT OR UPDATE OF cpf ON public.legal_annexes
FOR EACH ROW EXECUTE FUNCTION public.fn_legal_annex_link_aluno();

-- 5. updated_at trigger
CREATE TRIGGER trg_legal_annex_updated
BEFORE UPDATE ON public.legal_annexes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS
ALTER TABLE public.legal_annexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit legal annex"
  ON public.legal_annexes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can view annexes"
  ON public.legal_annexes FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update annexes"
  ON public.legal_annexes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete annexes"
  ON public.legal_annexes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Allow edge function (anon) to upsert: also need SELECT for the upsert lookup by CPF
CREATE POLICY "Anyone can read annex by cpf for upsert"
  ON public.legal_annexes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update for upsert"
  ON public.legal_annexes FOR UPDATE
  TO anon
  USING (true);

-- 7. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal_annex_attachments', 'legal_annex_attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone upload legal annex attachments"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'legal_annex_attachments');

CREATE POLICY "Anyone read legal annex attachments"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'legal_annex_attachments');

CREATE POLICY "Admin delete legal annex attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'legal_annex_attachments' AND public.is_admin(auth.uid()));
