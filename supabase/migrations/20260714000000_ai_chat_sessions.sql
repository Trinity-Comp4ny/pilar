-- Chat conversacional (copiloto agêntico) — fundação de dados.
--
-- MVP consultivo: o usuário conversa com o orquestrador (edge function ai-chat),
-- que roteia para agentes de domínio read-only. Este migration cria a persistência
-- de sessões e mensagens. Nada aqui grava dados de domínio — apenas o histórico do chat.
--
-- Privacidade: o chat é PESSOAL. RLS amarra tudo ao dono da sessão (auth.uid()),
-- não à empresa inteira — um membro não lê a conversa de outro. empresa_id fica
-- para escopo/auditoria e para futuros agentes de domínio.

-- ---------------------------------------------------------------------------
-- chat_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text,                                  -- resumo curto da conversa (gerado da 1ª mensagem)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id, updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- O dono vê/gerencia apenas as próprias sessões, dentro da própria empresa.
CREATE POLICY "chat_sessions_owner_all" ON public.chat_sessions
  FOR ALL
  USING (user_id = auth.uid() AND empresa_id = get_user_empresa_id())
  WITH CHECK (user_id = auth.uid() AND empresa_id = get_user_empresa_id());

CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  -- meta: agentes acionados, intenção detectada, dados consultados (para o "ver agentes trabalhando")
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Mensagens visíveis/graváveis apenas pelo dono da sessão a que pertencem.
CREATE POLICY "chat_messages_owner_all" ON public.chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.chat_sessions IS 'Sessões do chat conversacional (copiloto agêntico). Pessoal por usuário.';
COMMENT ON TABLE public.chat_messages IS 'Mensagens do chat. role=user|assistant. meta guarda agentes acionados e intenção.';
