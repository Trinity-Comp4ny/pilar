# SPEC 151: Conector da Pilar para ChatGPT e Claude (MCP + OAuth)

**Data:** 2026-11-10
**Status:** Em implementação (fase 1 no ar em staging desde 2026-11-10; produção e publicação nos diretórios pendentes, ver "Próximos passos")
**Autor:** CEO + Claude
**Módulo:** plataforma | ia

## Problema

O sócio do escritório já pergunta coisas ao ChatGPT e ao Claude no dia a dia, mas os dados do
escritório estão na Pilar. Para saber "quais projetos estão atrasados" ou "quanto entra este mês"
ele precisa sair da conversa, abrir o app e montar a resposta à mão.

## Objetivo

O usuário conecta a Pilar ao ChatGPT, ao Claude (claude.ai e Desktop) ou a outro cliente MCP
colando uma URL e autorizando na tela da Pilar. A partir daí o assistente consulta os dados do
escritório com o acesso daquele usuário.

**Fora de escopo (fase 1):**

- Escrita de qualquer tipo. O conector só lê. Criar ou alterar algo vem na fase 2, como rascunho
  que o usuário aprova no app ("A IA prepara. O sistema confere. Você aprova.").
- Tela "Apps conectados" para ver e revogar acessos (fase 2). Até lá, quem quiser revogar remove
  o conector no ChatGPT/Claude, e o suporte revoga pelo painel do Supabase.
- Pessoas e folha (dado sensível), obras e módulos dormentes.
- Decidir em que plano o conector entra (`PRICING.md`): fica para depois do piloto.

## Como funciona

```
ChatGPT / Claude ──POST sem token──▶ função mcp ──401 + WWW-Authenticate (metadados RFC 9728)
        │
        ├─ descobre o servidor OAuth 2.1 do Supabase Auth (/.well-known/oauth-authorization-server)
        ├─ registra-se sozinho (registro dinâmico de cliente)
        ├─ manda o usuário para app.pilarsoft.com.br/oauth/autorizar  ◀── tela da Pilar
        │        (login normal, Google e MFA; mostra quem pede, o que pode, para onde volta)
        ├─ recebe o token do usuário (JWT com client_id)
        └─ chama a função mcp com o token: tools/list, tools/call
                 └─ lê com o cliente do usuário: a RLS decide o que aparece, igual ao app
```

- **Servidor MCP:** Edge Function `mcp` (`supabase/functions/mcp`). JSON-RPC 2.0 sobre Streamable
  HTTP, sem sessão e sem stream: `initialize`, `ping`, `tools/list`, `tools/call`. Versões do
  protocolo 2024-11-05 a 2025-11-25.
- **Ferramentas (só leitura):** `buscar_projetos`, `detalhar_projeto`, `buscar_propostas`,
  `buscar_leads`, `buscar_clientes`, `resumo_financeiro`. Todas com `readOnlyHint`.
- **Autorização:** servidor OAuth 2.1 do Supabase Auth (beta, sem custo no beta). Tela de
  consentimento da Pilar em `/oauth/autorizar` (`src/pages/oauth/Autorizar.tsx`).

## Requisitos

1. O usuário conecta colando a URL do conector e autorizando na tela da Pilar.
2. A tela de autorização mostra o nome do app, o escritório, o que o app vai e não vai poder fazer
   e o domínio para onde o usuário volta (o nome do app é autodeclarado no registro dinâmico; o
   domínio de retorno é o sinal confiável contra phishing).
3. Sem login, ou faltando o segundo fator, o pedido fica guardado na aba e é retomado depois do
   login (senha, Google ou MFA).
4. Cada ferramenta lê com o token do usuário: o que ele não vê no app, não vê pelo conector. Valor
   de dinheiro vem vazio para quem não vê financeiro (`*_safe`, `can_view_financeiro`).
5. Dados bancários e documentos de cliente não saem pelo conector.
6. Assinatura cancelada (fora do período pago) ou expirada sem a janela de leitura bloqueia as
   ferramentas, com mensagem para regularizar no app (mesma regra do `PrivateRoute`).
7. Limite de 120 chamadas por minuto por usuário (`check_rate_limit`, bucket `mcp`).
8. Cada chamada de ferramenta fica no log estruturado: usuário, empresa, `client_id` do app,
   ferramenta, erro e duração. Os argumentos e o resultado ficam fora do log.

### Segurança: o token de app externo é só leitura em todo lugar

O token que o ChatGPT recebe é um JWT comum do usuário, com a claim `client_id`. Ele vale em
qualquer API do projeto, não só na função `mcp`. Sem trava, autorizar o ChatGPT daria a ele o poder
de escrever tudo o que o usuário escreve. Três travas:

| Porta de entrada              | Trava                                                                     | Onde                                                                |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Data API (REST, RPC, GraphQL) | pre-request recusa (403) todo método que não seja GET/HEAD                | `seguranca.pre_request_app_externo` (migration `20261210000000`)    |
| Storage                       | políticas RESTRICTIVE em `storage.objects` para INSERT/UPDATE/DELETE      | mesma migration                                                     |
| Edge Functions                | `recusarAppExterno(req)` logo após o `getUser`; `authenticateUser` já faz | `_shared/cors.ts`; teste de padrão reprova função nova que esquecer |

A sessão do próprio app não tem `client_id` e não muda em nada (coberto no pgTAP). Ultra admin
entre empresas exige `aal2`, que o token de app externo não tem.

**Risco aberto (verificar no teste de staging):** o token também chega à API do Auth
(`PUT /auth/v1/user`). A troca de e-mail pede confirmação nos dois endereços
(`double_confirm_changes`), mas a troca de senha precisa ser testada com um token OAuth real. Se o
Auth aceitar, a mitigação é um Auth Hook ou desligar a troca de senha sem reautenticação.

## Critérios de aceite

- [x] Sem token, `POST /mcp` responde 401 com `WWW-Authenticate: Bearer resource_metadata="..."`.
- [x] `GET /mcp/.well-known/oauth-protected-resource` aponta o servidor de autorização.
- [x] `initialize` negocia a versão; `tools/list` traz as seis ferramentas só de leitura.
- [x] Entrada inválida volta como erro legível para o modelo, sem consultar o banco.
- [x] Quem não vê financeiro recebe valores vazios e `resumo_financeiro` diz que não tem acesso.
- [x] `buscar_clientes` não pede dado bancário nem documento.
- [x] Tela de autorização: permitir e recusar voltam para o app pelo redirect do Supabase; redirect
      `javascript:`/`data:` é recusado; pedido já autorizado volta direto.
- [x] Sem login ou sem MFA: o pedido fica guardado e o `PrivateRoute` volta para a tela depois.
- [x] Token com `client_id` não faz POST/PATCH na Data API nem escreve no Storage; sessão do app
      continua escrevendo (pgTAP `app_externo_somente_leitura.sql`).
- [x] Toda Edge Function que autentica usuário recusa token de app externo (teste de padrão).
- [ ] Ponta a ponta em staging: conectar pelo claude.ai e pelo ChatGPT, autorizar, perguntar
      "quais projetos estão em andamento?" e receber a lista certa.
- [ ] Em staging, com token OAuth real: `POST /rest/v1/<tabela>` responde 403 e
      `PUT /auth/v1/user` com senha nova é recusado (ver risco aberto).

## Domínio próprio (o usuário nunca vê "supabase")

Sem domínio próprio, a URL do conector é `https://<ref>.supabase.co/functions/v1/mcp` e o
endereço do Supabase aparece na descoberta do OAuth. Com o **domínio customizado do Supabase**
(add-on pago, exige plano Pro), tudo passa para `api.pilarsoft.com.br`:

| O quê                   | Sem domínio                                  | Com domínio                                                                                   |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| URL que o usuário cola  | `https://<ref>.supabase.co/functions/v1/mcp` | `https://api.pilarsoft.com.br/functions/v1/mcp` (ou `https://mcp.pilarsoft.com.br`, opcional) |
| Servidor de autorização | `https://<ref>.supabase.co/auth/v1`          | `https://api.pilarsoft.com.br/auth/v1`                                                        |
| Tela que o usuário vê   | `app.pilarsoft.com.br/oauth/autorizar`       | igual                                                                                         |

Mascarar só a URL do MCP (rewrite na Vercel) não basta: o OAuth exige que o emissor do token seja
o mesmo endereço da descoberta, então o `supabase.co` continuaria aparecendo no fluxo. O domínio
customizado resolve de uma vez, inclusive no app (hoje o DevTools do app mostra `supabase.co`).
Esconder o provedor é marca, não proteção: quem protege o dado é a RLS e as travas acima.

A função lê `MCP_PUBLIC_URL` e `MCP_AUTH_ISSUER` (secrets da função). Sem eles, usa o endereço do
projeto; com o domínio, os dois apontam para ele.

## Runbook de ativação

**Staging primeiro, produção depois do teste ponta a ponta.**

1. **Supabase (painel, Authentication > OAuth Server):** ligar o OAuth 2.1 Server; caminho de
   autorização `/oauth/autorizar`; ligar o registro dinâmico de cliente. Conferir em
   Authentication > URL Configuration que o Site URL é o do app do ambiente
   (`https://staging.pilarsoft.com.br` / `https://app.pilarsoft.com.br`).
2. **Chaves JWT assimétricas (recomendado pelo Supabase para OAuth):** conferir em Settings > JWT
   Keys se o projeto já usa chave assimétrica; se não, migrar antes de abrir para cliente.
3. **Migration e função:** entram pelo deploy normal do CI depois do merge (nunca `db push` de
   branch). A função `mcp` sobe com `verify_jwt = false` (config.toml).
4. **Domínio (opcional para o piloto, obrigatório para cliente):** contratar o add-on Custom
   Domain no projeto de produção, criar o CNAME `api.pilarsoft.com.br`, verificar, e então definir
   os secrets da função: `MCP_PUBLIC_URL=https://api.pilarsoft.com.br/functions/v1/mcp` e
   `MCP_AUTH_ISSUER=https://api.pilarsoft.com.br/auth/v1`.
5. **Teste ponta a ponta** (critérios em aberto acima): claude.ai (Configurações > Connectors >
   adicionar connector personalizado) e ChatGPT (Connectors, modo desenvolvedor se exigido pelo
   plano), com um usuário admin e um sem acesso ao financeiro.
6. **Monitorar** os logs da função `mcp` (`ferramenta chamada`) e os registros de cliente OAuth no
   painel nas primeiras semanas (o registro dinâmico aceita qualquer cliente; quem decide é o
   usuário na tela de autorização).

## Próximos passos

Decisão do CEO (DECISOES.md, 2026-11-10): o usuário final não vai colar URL de conector. O
caminho é **publicar a Pilar nos diretórios oficiais do Claude e do ChatGPT**, como fazem Notion,
Canva e Slack. É um processo com revisão externa (dias a semanas), então fica planejado para
depois da fase 1 validada em staging.

### Como fica para o usuário depois de publicado

- **Claude:** o usuário escreve "conecte a Pilar" (ou só pergunta algo do escritório). O Claude
  sugere o conector do diretório, a instalação é um clique, a tela `/oauth/autorizar` abre, ele
  permite, e a Pilar fica em todas as conversas.
- **ChatGPT:** a Pilar aparece em chatgpt.com/apps; o usuário começa a frase com "Pilar, ..." ou
  "@Pilar" e, na primeira vez, conecta em dois cliques mais a tela da Pilar.
- O clique em "Permitir acesso" na tela da Pilar continua: é o consentimento do dono da conta,
  e nenhum diretório pula essa etapa.

### Checklist para publicar (fase 3)

Já atendido pela fase 1: servidor remoto em HTTPS, OAuth 2.1 com tela de consentimento, e toda
ferramenta com `title`, `readOnlyHint` e `destructiveHint` (o motivo de reprovação mais comum).

- [ ] **Domínio próprio** `api.pilarsoft.com.br` (add-on de domínio do Supabase) e secrets
      `MCP_PUBLIC_URL` / `MCP_AUTH_ISSUER`. Fazer ANTES de submeter: a URL fica gravada no
      diretório e trocar depois obriga todo usuário a reconectar.
- [ ] **Produção:** release staging→main com a fase 1 e OAuth 2.1 Server ligado no painel de
      produção (mesma configuração de staging).
- [ ] **Teste ponta a ponta** em staging e produção (critérios em aberto acima), incluindo o risco
      do `PUT /auth/v1/user` com token OAuth.
- [ ] **Política de privacidade** com seção do conector: que dados saem, para quem (OpenAI,
      Anthropic), base legal LGPD, como revogar. Sem isso a submissão é reprovada.
- [ ] **Página pública** do conector no site (o que faz, como conectar, como desconectar, suporte).
- [ ] **Material da listagem:** nome, descrição curta e longa, ícone/logo, capturas de tela,
      e-mail de suporte, categorias. Copy pela voz da marca (`brand/voice-tone.md`).
- [ ] **Conta de teste para os revisores**, num escritório de exemplo só com dado fictício.
- [ ] **Botão "Usar a Pilar no Claude / ChatGPT"** em Configurações (e no onboarding) que leva à
      página do conector no diretório; até a aprovação, mostra a URL para copiar.
- [ ] **"Apps conectados"** em Configurações (listar e revogar acessos), que os revisores esperam
      ver como forma de desconectar.
- [ ] **Submeter ao Claude:** portal em claude.ai/directory/manage (opção "MCP connector"),
      seguindo `claude.com/docs/connectors/building/submission` e `.../review-criteria`.
- [ ] **Submeter ao ChatGPT:** fluxo de submissão de apps na plataforma de desenvolvedores da
      OpenAI (Apps SDK), seguindo as app submission guidelines vigentes.
- [ ] Conferir nas páginas oficiais, no dia, os requisitos e quem pode submeter: os guias de
      terceiros divergem e as regras mudam com frequência.

**Atalho até a aprovação:** escritórios com Claude Team/Enterprise ou ChatGPT Business/Enterprise
podem ter o conector adicionado uma vez pelo administrador da organização; cada pessoa só clica
em "Conectar". Serve para o piloto com o design partner.

### Evolução do conector (fase 2)

- "Apps conectados" em Configurações: listar e revogar (`supabase.auth.oauth.listGrants` /
  `revokeGrant`).
- Ferramentas de escrita via rascunho ou pendência que o usuário aprova no app (agentes, SPEC 084).
- Trilha de auditoria em tabela (hoje é log estruturado).
- Decidir em que plano o conector entra e se consome crédito (o raciocínio roda no ChatGPT/Claude
  do cliente, então o custo de modelo não é da Pilar).

## Decisões e riscos

- **Supabase Auth como servidor OAuth, e não um servidor próprio:** reaproveita usuários, login
  Google, MFA e RLS; o token já é um JWT que a RLS entende. Risco: o recurso está em beta.
- **Função stateless em Edge Function, sem SDK do MCP:** o protocolo usado (4 métodos) é pequeno,
  testável sem rede e sem dependência nova. Se a fase 2 precisar de recursos do protocolo (stream,
  elicitation, apps com UI), avaliar o SDK oficial.
- **Só leitura em todas as portas:** o token de app externo vale como o usuário; travar só o MCP
  deixaria a Data API aberta para escrita.
- **Audiência do token:** o Supabase Auth não emite token por recurso (resource indicators); a
  função aceita qualquer token válido do projeto. Aceitável enquanto o único recurso OAuth é o
  conector.
