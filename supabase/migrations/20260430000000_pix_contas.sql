-- Chaves PIX da empresa por conta bancária
ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS tipo_chave_pix TEXT
    CHECK (tipo_chave_pix IN ('cpf_cnpj', 'email', 'telefone', 'aleatoria')),
  ADD COLUMN IF NOT EXISTS chave_pix TEXT;

-- Chaves PIX do cliente (lista independente das contas bancárias)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS chaves_pix JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contas.chave_pix IS 'Chave PIX principal desta conta';
COMMENT ON COLUMN public.contas.tipo_chave_pix IS 'Tipo: cpf_cnpj, email, telefone, aleatoria';
COMMENT ON COLUMN public.clientes.chaves_pix IS 'Lista de chaves PIX do cliente: [{chave, tipo}]';
