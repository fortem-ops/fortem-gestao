
-- 1. ENUM for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'coordenador', 'professor', 'nutricionista', 'fisioterapeuta');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coordinator_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'coordenador')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 4. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  specialty TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Alunos table
CREATE TABLE public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  data_nascimento DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'licenca', 'encerrado')),
  frequencia_semanal INT DEFAULT 3 CHECK (frequencia_semanal BETWEEN 0 AND 7),
  foto_url TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view alunos" ON public.alunos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert alunos" ON public.alunos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Coord/admin can update alunos" ON public.alunos
  FOR UPDATE TO authenticated USING (
    public.is_coordinator_or_admin(auth.uid()) OR responsavel_id = auth.uid()
  );
CREATE POLICY "Admin can delete alunos" ON public.alunos
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 6. Planos table
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Start', 'Start+', 'Power', 'Pro', 'Max')),
  data_inicio DATE NOT NULL,
  duracao_meses INT NOT NULL DEFAULT 6,
  servicos TEXT[] DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view planos" ON public.planos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin can insert planos" ON public.planos
  FOR INSERT TO authenticated WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin can update planos" ON public.planos
  FOR UPDATE TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Admin can delete planos" ON public.planos
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 7. Avaliacoes table
CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('funcional', 'composicao_corporal', 'pliometria', 'forca', 'experimental', 'kinology')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  avaliador_id UUID REFERENCES auth.users(id) NOT NULL,
  dados JSONB DEFAULT '{}',
  observacoes TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view avaliacoes" ON public.avaliacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert avaliacoes" ON public.avaliacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = avaliador_id);
CREATE POLICY "Author or coord/admin can update avaliacoes" ON public.avaliacoes
  FOR UPDATE TO authenticated USING (
    auth.uid() = avaliador_id OR public.is_coordinator_or_admin(auth.uid())
  );
CREATE POLICY "Admin can delete avaliacoes" ON public.avaliacoes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 8. Avaliacao funcional table
CREATE TABLE public.avaliacao_funcional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID REFERENCES public.avaliacoes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tornozelo_esq NUMERIC,
  tornozelo_dir NUMERIC,
  quadril_ri_esq NUMERIC,
  quadril_ri_dir NUMERIC,
  quadril_re_esq NUMERIC,
  quadril_re_dir NUMERIC,
  ombro_ri_esq NUMERIC,
  ombro_ri_dir NUMERIC,
  ombro_re_esq NUMERIC,
  ombro_re_dir NUMERIC,
  toracica_esq NUMERIC,
  toracica_dir NUMERIC,
  flex_mmii_esq NUMERIC,
  flex_mmii_dir NUMERIC,
  flex_psoas_esq NUMERIC,
  flex_psoas_dir NUMERIC,
  flex_quadriceps_esq NUMERIC,
  flex_quadriceps_dir NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.avaliacao_funcional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view avaliacao_funcional" ON public.avaliacao_funcional
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert avaliacao_funcional" ON public.avaliacao_funcional
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Coord/admin can update avaliacao_funcional" ON public.avaliacao_funcional
  FOR UPDATE TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

-- 9. Treinos table
CREATE TABLE public.treinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL,
  conteudo JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'atual' CHECK (status IN ('atual', 'arquivado')),
  autor_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view treinos" ON public.treinos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert treinos" ON public.treinos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = autor_id);
CREATE POLICY "Author or coord/admin can update treinos" ON public.treinos
  FOR UPDATE TO authenticated USING (
    auth.uid() = autor_id OR public.is_coordinator_or_admin(auth.uid())
  );
CREATE POLICY "Admin can delete treinos" ON public.treinos
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 10. Historico profissional table
CREATE TABLE public.historico_profissional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  autor_id UUID REFERENCES auth.users(id) NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('observacao', 'intervencao', 'orientacao', 'contato')),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.historico_profissional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view historico" ON public.historico_profissional
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert historico" ON public.historico_profissional
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = autor_id);
CREATE POLICY "Author or coord/admin can update historico" ON public.historico_profissional
  FOR UPDATE TO authenticated USING (
    auth.uid() = autor_id OR public.is_coordinator_or_admin(auth.uid())
  );
CREATE POLICY "Admin can delete historico" ON public.historico_profissional
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 11. Tarefas table
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES auth.users(id) NOT NULL,
  criado_por_id UUID REFERENCES auth.users(id) NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'atrasada')),
  data_limite DATE,
  automatica BOOLEAN NOT NULL DEFAULT false,
  tipo_auto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tarefas" ON public.tarefas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tarefas" ON public.tarefas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por_id);
CREATE POLICY "Responsible or coord/admin can update tarefas" ON public.tarefas
  FOR UPDATE TO authenticated USING (
    auth.uid() = responsavel_id OR public.is_coordinator_or_admin(auth.uid())
  );
CREATE POLICY "Admin can delete tarefas" ON public.tarefas
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 12. Uploads table
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pdf', 'imagem', 'relatorio', 'kinology', 'documento_clinico')),
  categoria TEXT,
  storage_path TEXT NOT NULL,
  autor_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view uploads" ON public.uploads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert uploads" ON public.uploads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = autor_id);
CREATE POLICY "Admin can delete uploads" ON public.uploads
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 13. Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('aluno-files', 'aluno-files', false);

CREATE POLICY "Authenticated users can view aluno files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'aluno-files');
CREATE POLICY "Authenticated users can upload aluno files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'aluno-files');
CREATE POLICY "Admin can delete aluno files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'aluno-files' AND public.is_admin(auth.uid()));

-- 14. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alunos_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_avaliacoes_updated_at BEFORE UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_treinos_updated_at BEFORE UPDATE ON public.treinos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tarefas_updated_at BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Indexes for performance
CREATE INDEX idx_alunos_status ON public.alunos(status);
CREATE INDEX idx_alunos_responsavel ON public.alunos(responsavel_id);
CREATE INDEX idx_planos_aluno ON public.planos(aluno_id);
CREATE INDEX idx_avaliacoes_aluno ON public.avaliacoes(aluno_id);
CREATE INDEX idx_avaliacoes_tipo ON public.avaliacoes(tipo);
CREATE INDEX idx_treinos_aluno ON public.treinos(aluno_id);
CREATE INDEX idx_historico_aluno ON public.historico_profissional(aluno_id);
CREATE INDEX idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);
CREATE INDEX idx_uploads_aluno ON public.uploads(aluno_id);
