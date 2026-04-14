-- ==============================================================================
-- 0. CONFIGURAÇÕES INICIAIS E EXTENSÕES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; 
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tipos ENUM
DO $$ BEGIN
    CREATE TYPE status_empresa AS ENUM ('active', 'suspended', 'cancelled');
    CREATE TYPE user_role AS ENUM ('admin', 'financeiro', 'marketing', 'operacional', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_projeto AS ENUM ('Planejamento', 'Em andamento', 'Revisão', 'Paralisado', 'Concluído', 'Cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_financeiro AS ENUM ('Pendente', 'Pago', 'Recebido', 'Atrasado', 'Cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_categoria AS ENUM ('Receita', 'Despesa');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_lead AS ENUM ('Novo', 'Em contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==============================================================================
-- 1. ESTRUTURA CORE (Empresas e Perfis)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  cnpj TEXT,
  status status_empresa DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id) -- Removida vírgula extra
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role DEFAULT 'user',
  contato TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id) -- Removida vírgula extra
);

-- ==============================================================================
-- 2. FUNÇÕES DE SEGURANÇA E UTILITÁRIOS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID 
LANGUAGE sql 
SECURITY DEFINER 
STABLE 
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles user_role[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = ANY(allowed_roles);
END;
$$;

-- Trigger Universal de Auditoria e Tenant
CREATE OR REPLACE FUNCTION public.handle_record_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Auto-Tenant
  IF TG_OP = 'INSERT' THEN
    BEGIN
      IF NEW.empresa_id IS NULL THEN
         NEW.empresa_id := public.get_user_empresa_id();
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL; END;

    BEGIN
      NEW.created_by := auth.uid();
    EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;

  -- 2. Auto-Timestamp
  BEGIN
    NEW.updated_at = NOW();
  EXCEPTION WHEN undefined_column THEN NULL; END;
  
  -- 3. Auditoria de Edição
  BEGIN
    NEW.updated_by := auth.uid();
  EXCEPTION WHEN undefined_column THEN NULL; END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_company_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'Segurança: Não é permitido alterar a empresa de um usuário ou registro manualmente.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.soft_delete_generic()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) USING OLD.id;
  RETURN NULL;
END;
$$;

-- ==============================================================================
-- 3. TABELAS DE NEGÓCIO
-- ==============================================================================

-- PESSOAS
CREATE TABLE IF NOT EXISTS public.pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id),
  nome TEXT NOT NULL,
  cpf TEXT,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  tipo_contrato TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  contato TEXT,
  email TEXT,
  endereco TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE, 
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT clientes_unique_empresa_cpf_cnpj UNIQUE (empresa_id, cpf_cnpj)
);

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  contato TEXT,
  status TEXT DEFAULT 'Novo',
  origem TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- FORNECEDORES
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  email TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fornecedores_unique_empresa_cnpj UNIQUE (empresa_id, cnpj)
);

-- CONTAS BANCÁRIAS
CREATE TABLE IF NOT EXISTS public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT NOT NULL,
  saldo_inicial DECIMAL(12,2) DEFAULT 0,
  cor TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT contas_unique_empresa_nome UNIQUE (empresa_id, nome)
);

-- CARTÕES DE CRÉDITO
CREATE TABLE IF NOT EXISTS public.cartoes_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dia_fechamento INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite DECIMAL(12,2) NOT NULL,
  cor TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT cartoes_unique_empresa_nome UNIQUE (empresa_id, nome)
);

-- CATEGORIAS FINANCEIRAS
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo tipo_categoria NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT categorias_unique_empresa_nome_tipo UNIQUE (empresa_id, nome, tipo)
);

-- PROJETOS
CREATE TABLE IF NOT EXISTS public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE RESTRICT,
  codigo_projeto TEXT, 
  nome TEXT NOT NULL,
  localizacao TEXT,
  status status_projeto DEFAULT 'Planejamento',
  data_inicio DATE,
  data_previsao DATE,
  data_final DATE,
  valor_contrato DECIMAL(12,2),
  observacao TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT projetos_unique_empresa_codigo UNIQUE (empresa_id, codigo_projeto)
);

-- RESPONSÁVEIS POR PROJETO
CREATE TABLE IF NOT EXISTS public.projetos_responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  disciplina TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RECEITAS
CREATE TABLE IF NOT EXISTS public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  status status_financeiro DEFAULT 'Pendente',
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  nota_fiscal TEXT,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- DESPESAS
CREATE TABLE IF NOT EXISTS public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status status_financeiro DEFAULT 'Pendente',
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  cartao_id UUID REFERENCES public.cartoes_credito(id) ON DELETE SET NULL,
  nota_fiscal TEXT,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT origem_pagamento_check CHECK (
    (status = 'Pendente') OR 
    (status = 'Cancelado') OR
    (conta_id IS NOT NULL AND cartao_id IS NULL) OR 
    (conta_id IS NULL AND cartao_id IS NOT NULL)
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 4. VIEWS FINANCEIRAS
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_financas_resumo AS
SELECT
  c.id as conta_id,
  c.nome as conta_nome,
  c.banco,
  c.cor,
  c.empresa_id,
  c.saldo_inicial,
  COALESCE((SELECT SUM(r.valor) FROM public.receitas r WHERE r.conta_id = c.id AND r.status = 'Recebido' AND r.deleted_at IS NULL), 0) as total_entradas,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.conta_id = c.id AND d.status = 'Pago' AND d.deleted_at IS NULL), 0) as total_saidas,
  (c.saldo_inicial +
   COALESCE((SELECT SUM(r.valor) FROM public.receitas r WHERE r.conta_id = c.id AND r.status = 'Recebido' AND r.deleted_at IS NULL), 0) -
   COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.conta_id = c.id AND d.status = 'Pago' AND d.deleted_at IS NULL), 0)
  ) as saldo_atual
FROM public.contas c
WHERE c.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.view_cartao_resumo AS
SELECT
  cc.id,
  cc.nome,
  cc.empresa_id,
  cc.dia_fechamento,
  cc.dia_vencimento,
  cc.cor,
  cc.limite,
  cc.conta_pagamento_id,
  COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0) as usado,
  (cc.limite - COALESCE((SELECT SUM(d.valor) FROM public.despesas d WHERE d.cartao_id = cc.id AND d.status = 'Pendente' AND d.deleted_at IS NULL), 0)) as disponivel
FROM public.cartoes_credito cc
WHERE cc.deleted_at IS NULL;

-- ==============================================================================
-- 5. INDEXES & PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_clientes_nome_trgm ON public.clientes USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projetos_nome_trgm ON public.projetos USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_receitas_desc_trgm ON public.receitas USING GIN (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_despesas_desc_trgm ON public.despesas USING GIN (descricao gin_trgm_ops);

CREATE INDEX idx_pessoas_empresa ON public.pessoas(empresa_id);
CREATE INDEX idx_clientes_empresa ON public.clientes(empresa_id);
CREATE INDEX idx_leads_empresa ON public.leads(empresa_id);
CREATE INDEX idx_fornecedores_empresa ON public.fornecedores(empresa_id);
CREATE INDEX idx_contas_empresa ON public.contas(empresa_id);
CREATE INDEX idx_cartoes_empresa ON public.cartoes_credito(empresa_id);
CREATE INDEX idx_projetos_empresa ON public.projetos(empresa_id);
CREATE INDEX idx_receitas_empresa ON public.receitas(empresa_id);
CREATE INDEX idx_despesas_empresa ON public.despesas(empresa_id);
CREATE INDEX idx_receitas_vencimento ON public.receitas (empresa_id, data_vencimento);
CREATE INDEX idx_despesas_vencimento ON public.despesas (empresa_id, data_vencimento);

-- ==============================================================================
-- 6. SEGURANÇA: ROW LEVEL SECURITY (RLS) - RBAC IMPLEMENTADO
-- ==============================================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS GERAIS DE TENANT 
-- (Todos só veem dados da sua empresa. O filtro de Role vem abaixo)

-- === FINANCEIRO ===
-- Admin e Financeiro: Full Access
CREATE POLICY "Financeiro Full Receitas" ON public.receitas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);
  
CREATE POLICY "Financeiro Full Despesas" ON public.despesas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);
  
CREATE POLICY "Financeiro Full Contas" ON public.contas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);
  
CREATE POLICY "Financeiro Full Cartoes" ON public.cartoes_credito
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);
  
CREATE POLICY "Financeiro Full Fornecedores" ON public.fornecedores
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro') AND deleted_at IS NULL);
  
CREATE POLICY "Financeiro Full Categorias" ON public.categorias_financeiras
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro')) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'financeiro'));

-- === PROJETOS ===
-- Admin/Operacional: Full
-- Financeiro: Read Only
CREATE POLICY "Projetos Full" ON public.projetos
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'operacional')
    AND deleted_at IS NULL
  ) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional') AND deleted_at IS NULL);

CREATE POLICY "Projetos Read" ON public.projetos
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('financeiro')
    AND deleted_at IS NULL
  );

CREATE POLICY "ProjResp Full" ON public.projetos_responsaveis
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional')) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'operacional'));
  
CREATE POLICY "ProjResp Read" ON public.projetos_responsaveis
  FOR SELECT USING (empresa_id = public.get_user_empresa_id() AND public.has_role('financeiro'));

-- === CLIENTES ===
-- Admin/Marketing: Full
-- Financeiro/Operacional: Read Only
CREATE POLICY "Clientes Full" ON public.clientes
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('admin', 'marketing')
    AND deleted_at IS NULL
  ) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'marketing') AND deleted_at IS NULL);

CREATE POLICY "Clientes Read" ON public.clientes
  FOR SELECT USING (
    empresa_id = public.get_user_empresa_id() 
    AND public.has_role('financeiro', 'operacional')
    AND deleted_at IS NULL
  );

-- === LEADS ===
-- Admin/Marketing: Full
CREATE POLICY "Leads Full" ON public.leads
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'marketing')) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin', 'marketing'));

-- === PESSOAS (RH) ===
-- Admin: Full
-- Outros: Read Only
CREATE POLICY "Pessoas Full" ON public.pessoas
  FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin')) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));
  
CREATE POLICY "Pessoas Read" ON public.pessoas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());

-- === SISTEMA (Empresa e Profiles) ===
CREATE POLICY "Ver própria empresa" ON public.empresas FOR SELECT USING (id = public.get_user_empresa_id());
CREATE POLICY "Admin edita empresa" ON public.empresas FOR UPDATE USING (id = public.get_user_empresa_id() AND public.has_role('admin'));

CREATE POLICY "Ver profiles da empresa" ON public.profiles FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Admin gere profiles" ON public.profiles FOR ALL USING (empresa_id = public.get_user_empresa_id() AND public.has_role('admin')) WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role('admin'));
CREATE POLICY "Usuario edita seu profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- ==============================================================================
-- 7. TRIGGERS (Automação Completa)
-- ==============================================================================

-- Tabelas de Negócio (Auditoria + Tenant)
CREATE TRIGGER tr_audit_pessoas BEFORE INSERT OR UPDATE ON public.pessoas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_clientes BEFORE INSERT OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_leads BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_fornecedores BEFORE INSERT OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_contas BEFORE INSERT OR UPDATE ON public.contas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_cartoes BEFORE INSERT OR UPDATE ON public.cartoes_credito FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_categorias BEFORE INSERT OR UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_projetos BEFORE INSERT OR UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_proj_resp BEFORE INSERT OR UPDATE ON public.projetos_responsaveis FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_receitas BEFORE INSERT OR UPDATE ON public.receitas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_despesas BEFORE INSERT OR UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

-- Tabelas de Sistema (Auditoria também)
CREATE TRIGGER tr_audit_empresas BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();
CREATE TRIGGER tr_audit_profiles BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_record_audit();

-- Segurança Extra
CREATE TRIGGER check_profile_company_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_company_change();

-- Soft Delete
CREATE TRIGGER tr_soft_del_clientes BEFORE DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_projetos BEFORE DELETE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_receitas BEFORE DELETE ON public.receitas FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_despesas BEFORE DELETE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_contas BEFORE DELETE ON public.contas FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_fornecedores BEFORE DELETE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_cartoes BEFORE DELETE ON public.cartoes_credito FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_pessoas BEFORE DELETE ON public.pessoas FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();
CREATE TRIGGER tr_soft_del_leads BEFORE DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.soft_delete_generic();

-- ==============================================================================
-- 8. HOOK DE NOVO USUÁRIO (Smart Trigger)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_role user_role;
  meta_empresa_id TEXT;
  meta_cargo TEXT;
  meta_nome TEXT;
BEGIN
  -- Ler metadados
  meta_empresa_id := NEW.raw_user_meta_data->>'empresa_id_convite';
  meta_cargo := NEW.raw_user_meta_data->>'cargo_convite';
  meta_nome := NEW.raw_user_meta_data->>'nome';

  -- CENÁRIO 1: É UM FUNCIONÁRIO CONVIDADO (Veio com ID de empresa)
  IF meta_empresa_id IS NOT NULL THEN
    v_empresa_id := meta_empresa_id::UUID;
    
    -- Tenta usar o cargo do convite, fallback para 'user' se inválido
    BEGIN
      v_role := meta_cargo::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'user';
    END;

    INSERT INTO public.profiles (id, empresa_id, nome, email, role)
    VALUES (NEW.id, v_empresa_id, COALESCE(meta_nome, NEW.email), NEW.email, v_role);

  -- CENÁRIO 2: É UM NOVO DONO (Sem ID de empresa -> Cria Nova)
  ELSE
    INSERT INTO public.empresas (owner_id, nome)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'))
    RETURNING id INTO v_empresa_id;

    INSERT INTO public.profiles (id, empresa_id, nome, email, role)
    VALUES (NEW.id, v_empresa_id, COALESCE(meta_nome, NEW.email), NEW.email, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
