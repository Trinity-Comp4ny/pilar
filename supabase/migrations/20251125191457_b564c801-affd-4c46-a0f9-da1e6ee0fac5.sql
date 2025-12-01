-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create clientes table
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  endereco TEXT,
  contato TEXT,
  tipo_nf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clientes"
  ON public.clientes FOR ALL
  USING (auth.uid() = user_id);

-- Create funcionarios table
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  cargo TEXT,
  admissao DATE,
  demissao DATE,
  salario_fixo DECIMAL(10,2),
  valor_m2 DECIMAL(10,2),
  celular TEXT,
  email TEXT,
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own funcionarios"
  ON public.funcionarios FOR ALL
  USING (auth.uid() = user_id);

-- Create projetos table
CREATE TABLE public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  localizacao TEXT,
  placa TEXT,
  post TEXT,
  data_inicio DATE,
  data_previsao DATE,
  data_final DATE,
  contrato TEXT,
  status TEXT DEFAULT 'Em andamento',
  briefing TEXT,
  arquiteto TEXT,
  tipo TEXT,
  pacote TEXT,
  m2 DECIMAL(10,2),
  parcelas INTEGER,
  valor_total DECIMAL(12,2),
  responsavel_eletrico UUID REFERENCES public.funcionarios(id),
  responsavel_hidraulico UUID REFERENCES public.funcionarios(id),
  responsavel_modelagem UUID REFERENCES public.funcionarios(id),
  responsavel_detalhamento UUID REFERENCES public.funcionarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projetos"
  ON public.projetos FOR ALL
  USING (auth.uid() = user_id);

-- Create receitas table
CREATE TABLE public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_recebimento DATE NOT NULL,
  descricao TEXT NOT NULL,
  projeto_id UUID REFERENCES public.projetos(id),
  categoria TEXT,
  valor_total DECIMAL(12,2) NOT NULL,
  forma_pagamento TEXT,
  nota_fiscal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own receitas"
  ON public.receitas FOR ALL
  USING (auth.uid() = user_id);

-- Create despesas table
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_pagamento DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor_total DECIMAL(12,2) NOT NULL,
  parcelas INTEGER DEFAULT 1,
  forma_pagamento TEXT,
  responsavel UUID REFERENCES public.funcionarios(id),
  fornecedor TEXT,
  projeto_id UUID REFERENCES public.projetos(id),
  nota_fiscal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own despesas"
  ON public.despesas FOR ALL
  USING (auth.uid() = user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add triggers for all tables
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_clientes
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_funcionarios
  BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_projetos
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_receitas
  BEFORE UPDATE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_despesas
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();