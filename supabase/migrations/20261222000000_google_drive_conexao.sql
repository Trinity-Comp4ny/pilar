-- Google Drive conectado à Pilar (SPEC 163, opção B).
--
-- O escritório conecta UMA conta Google (em Configurações, só admin). A Pilar usa o
-- escopo drive.file: enxerga só o que ela mesma cria ou o que o usuário escolhe por ela.
-- Cada projeto ganha uma pasta no Drive, com uma subpasta por disciplina, e a equipe
-- navega, cria pasta, envia, baixa e apaga arquivo sem sair da Pilar. A Pilar não guarda
-- arquivo: o binário vai do navegador direto para o Google.
--
-- Três tabelas:
--   * google_drive_conexoes: a conta conectada e o refresh token, CIFRADO na Edge Function
--     (AES-GCM com GOOGLE_DRIVE_TOKEN_KEY). Só service_role lê: RLS ligada, sem policy,
--     sem grant para anon/authenticated. Vazar o banco sozinho não entrega o token.
--   * google_drive_oauth_estados: o "state" do OAuth (só o hash), contra CSRF no retorno
--     do Google. Expira em 10 minutos. Só service_role.
--   * drive_pastas: as pastas que a Pilar conhece, ligadas a projeto e disciplina. É a
--     lista do que a Edge Function aceita listar e mexer: um id de pasta que não está aqui
--     (ou é de outra empresa) é recusado. A equipe lê pela RLS; só a Edge Function escreve.
--
-- get_google_drive_status(): o que a tela precisa saber da conexão (sem o token).

-- 1. Conexão -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_drive_conexoes (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_cifrado text NOT NULL,
  pasta_raiz_id text NOT NULL,
  conectado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_drive_conexoes_conectado_por_idx
  ON public.google_drive_conexoes (conectado_por);

ALTER TABLE public.google_drive_conexoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_drive_conexoes FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.google_drive_conexoes IS
  'Conta Google Drive conectada por empresa (SPEC 163). Token cifrado; só service_role.';

-- 2. State do OAuth ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_drive_oauth_estados (
  estado_hash text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Página do app para onde o Google devolve o usuário (caminho relativo, validado).
  retorno text NOT NULL DEFAULT '/',
  expira_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_drive_oauth_estados_empresa_idx
  ON public.google_drive_oauth_estados (empresa_id);
CREATE INDEX IF NOT EXISTS google_drive_oauth_estados_usuario_idx
  ON public.google_drive_oauth_estados (usuario_id);

ALTER TABLE public.google_drive_oauth_estados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_drive_oauth_estados FROM PUBLIC, anon, authenticated;

-- 3. Pastas conhecidas -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drive_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  -- Subpasta de uma disciplina; null na pasta do projeto e nas criadas à mão.
  projeto_disciplina_id uuid REFERENCES public.projeto_disciplinas(id) ON DELETE SET NULL,
  pasta_id text NOT NULL,
  -- null = pasta do projeto (a raiz dele no Drive).
  pasta_pai_id text,
  nome text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_pastas_pasta_unica UNIQUE (empresa_id, pasta_id)
);

CREATE INDEX IF NOT EXISTS drive_pastas_projeto_idx ON public.drive_pastas (projeto_id);
CREATE INDEX IF NOT EXISTS drive_pastas_disciplina_idx ON public.drive_pastas (projeto_disciplina_id);
CREATE INDEX IF NOT EXISTS drive_pastas_created_by_idx ON public.drive_pastas (created_by);
-- Uma pasta raiz por projeto e uma pasta por disciplina.
CREATE UNIQUE INDEX IF NOT EXISTS drive_pastas_raiz_do_projeto
  ON public.drive_pastas (projeto_id) WHERE pasta_pai_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drive_pastas_uma_por_disciplina
  ON public.drive_pastas (projeto_disciplina_id) WHERE projeto_disciplina_id IS NOT NULL;

ALTER TABLE public.drive_pastas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_pastas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.drive_pastas TO authenticated;

DROP POLICY IF EXISTS drive_pastas_select_empresa ON public.drive_pastas;
CREATE POLICY drive_pastas_select_empresa ON public.drive_pastas
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT public.get_user_empresa_id())
    AND (SELECT public.user_has_feature('projetos', 'viewer'))
  );

COMMENT ON TABLE public.drive_pastas IS
  'Pastas do Google Drive ligadas a projeto e disciplina (SPEC 163). Escrita só pela Edge Function google-drive.';

-- 4. Status da conexão para a tela ------------------------------------------
CREATE OR REPLACE FUNCTION public.get_google_drive_status()
RETURNS TABLE(conectado boolean, google_email text, conectado_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.empresa_id IS NOT NULL,
    c.google_email,
    c.created_at
  FROM (SELECT public.get_user_empresa_id() AS empresa_id) e
  LEFT JOIN public.google_drive_conexoes c ON c.empresa_id = e.empresa_id
  WHERE e.empresa_id IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_google_drive_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_drive_status() TO authenticated;
