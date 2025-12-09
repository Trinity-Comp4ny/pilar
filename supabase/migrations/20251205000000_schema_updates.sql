
-- Add fields to Clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_nf TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS origem TEXT;

-- Add fields to Pessoas
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS data_admissao DATE;
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS salario_fixo DECIMAL(12,2);
ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS valor_m2 DECIMAL(12,2);

-- Add fields to Leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- Add fields to Projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS parcelas TEXT;

-- Sync Pessoas <-> Profiles
CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        -- Attempt to find a profile with this email
        NEW.profile_id := (SELECT id FROM public.profiles WHERE email = NEW.email LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_link_pessoa_profile_before ON public.pessoas;
CREATE TRIGGER tr_link_pessoa_profile_before
BEFORE INSERT OR UPDATE OF email ON public.pessoas
FOR EACH ROW EXECUTE FUNCTION public.link_pessoa_profile_before();

CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
RETURNS TRIGGER AS $$
BEGIN
    -- When a profile is created/updated, link it to any existing pessoa with same email
    UPDATE public.pessoas
    SET profile_id = NEW.id
    WHERE email = NEW.email;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_link_profile_pessoa_after ON public.profiles;
CREATE TRIGGER tr_link_profile_pessoa_after
AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_profile_pessoa_after();
