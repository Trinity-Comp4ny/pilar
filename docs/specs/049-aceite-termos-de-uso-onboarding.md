# SPEC: Aceite explícito dos Termos de Uso no onboarding

**Data:** 2026-08-18
**Status:** Em implementação (código + migration local prontos, ver pendências no final do Plano)
**Autor:** Matheus Rezende + Claude
**Módulo:** auth / onboarding

## Problema

Hoje é possível criar e usar uma conta no Pilar sem nunca ter visto nem aceitado
os Termos de Uso. O botão "Criar conta" em `/cadastro` não tem checkbox de
aceite, e `/profile-setup` (o passo seguinte, obrigatório pra todo mundo) também
não. Isso é diferente do banner de cookies (que já existe e é sobre
privacidade/rastreamento): aqui o assunto é o **contrato de uso do produto**,
que é obrigatório para qualquer SaaS e hoje simplesmente não existe no Pilar.

## Objetivo

Todo usuário que passa a ter acesso funcional ao Pilar (self-serve, Google
OAuth, convite de empresa, ou dono criado via checkout) aceitou explicitamente
os Termos de Uso e a Política de Privacidade antes disso, com o aceite
registrado de forma auditável (quem, quando, qual versão do documento).

**Fora de escopo:**

- Re-consentimento de usuários que já usam o Pilar hoje (`onboarding_completed
= true`). Não interrompe quem já está ativo; a régua vale só pra conta nova
  a partir do deploy desta feature.
- Fluxo de "nova versão dos Termos → forçar re-aceite". A tabela guarda a
  versão aceita (dado necessário pra isso existir um dia), mas o gate de
  re-aceite em si fica pra quando houver de fato uma segunda versão publicada.
- Aceite por assinatura eletrônica com validade jurídica reforçada (ICP-Brasil,
  clicksign etc.). É um checkbox + registro de log, o padrão de mercado pra
  SaaS self-serve, não um contrato assinado formalmente.

## Requisitos

1. Em `/cadastro`, um checkbox "Li e concordo com os
   [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade)"
   (desmarcado por padrão) precisa estar marcado para habilitar tanto o botão
   "Criar conta" quanto "Continuar com Google". Os links abrem em nova aba
   (não perdem o formulário preenchido).
2. Ao submeter `/cadastro` com o checkbox marcado, o aceite é gravado
   (usuário, versão do documento, timestamp, origem `signup`) no mesmo
   instante em que `auth.users` é criado pelo `signUp()` (a trigger
   `handle_new_user()` é `AFTER INSERT ON auth.users`, dispara imediatamente,
   não espera a confirmação de email. Corrigido aqui após checar o trigger
   real; a v1 desta spec dizia o contrário).
3. Em `/profile-setup`, o mesmo checkbox aparece **sempre**, inclusive no
   ramo `pulaSenha` (contas Google e contas que já definiram senha no
   `/cadastro`); esse ramo hoje esconde os campos de senha, mas o aceite não
   pode ficar dependente dele. Ver risco de "convidado que nunca vê o
   checkbox" nos Critérios de aceite.
4. Se o usuário já tem um aceite registrado (ex.: veio do `/cadastro`, que já
   gravou), `/profile-setup` não pede de novo: mostra um texto informativo
   ("Você já aceitou os Termos de Uso em `/cadastro`") em vez do checkbox.
5. Sem aceite registrado, o botão "Continuar" de `/profile-setup` fica
   desabilitado até marcar o checkbox, inclusive para quem chegou por convite
   de empresa ou por checkout (dono criado via `create-company-owner`).
6. O aceite é **imutável**: uma vez gravado, não é editável nem removível
   pelo usuário (mesmo padrão de `audit_logs`). Revogação de conta é via
   exclusão de dados (fluxo já existente em `/privacidade`), não edição deste
   registro.

Requisitos não-funcionais:

- **Segurança / RLS:** tabela nova só aceita `INSERT` do próprio
  `auth.uid()` como `user_id`; sem `UPDATE`/`DELETE` para ninguém exceto
  `service_role`. `SELECT` só da própria linha (usuário) ou por admin/suporte
  via `service_role` (para runbook de disputa/auditoria).
- **Sem novo full-scan:** consulta "já aceitou?" é `SELECT ... WHERE user_id =
auth.uid() LIMIT 1`, indexada por `user_id`.
- **Multi-tenant:** `empresa_id` é opcional/nullable na tabela (o aceite é da
  pessoa, não da empresa; no momento do signup self-serve a empresa já existe
  na mesma transação da trigger, então dá pra preencher; convite e OAuth
  também já têm `empresa_id` resolvido a essa altura).

## Critérios de aceite

- [ ] Dado o formulário de `/cadastro` sem o checkbox marcado, quando o
      usuário preenche todo o resto, então os botões "Criar conta" e
      "Continuar com Google" continuam desabilitados.
- [ ] Dado o checkbox marcado e formulário válido, quando o usuário confirma o
      email e a conta é criada, então existe uma linha em `terms_acceptances`
      para esse `user_id` com `source = 'signup'`.
- [ ] Dado um usuário que aceitou no `/cadastro`, quando ele chega em
      `/profile-setup`, então **não** vê o checkbox de novo, só o aviso de que
      já aceitou.
- [ ] Dado um usuário Google (nunca passou pelo checkbox de `/cadastro`,
      porque o OAuth pula o formulário), quando ele chega em
      `/profile-setup`, então vê o checkbox e não consegue clicar
      "Continuar" sem marcá-lo, **mesmo estando no ramo `pulaSenha` sem
      campos de senha visíveis**.
- [ ] Dado um usuário convidado por outra empresa (link de convite,
      `invite_token` no metadata), quando ele chega em `/profile-setup`, então
      também vê e precisa marcar o checkbox (não existe fluxo de convite que
      pule `/profile-setup` hoje, confirmado em `PrivateRoute`).
- [ ] Dado um usuário dono criado via checkout (`create-company-owner`),
      mesmo comportamento do item acima.
- [ ] Dado um usuário que já usava o Pilar antes deste deploy
      (`onboarding_completed = true`), quando ele faz login, então **não** é
      interrompido para aceitar nada.
- [ ] Caso de borda: usuário fecha a aba logo depois de submeter `/cadastro`,
      antes de ver a tela "confira seu email" (aceite seria perdido se
      dependesse de um segundo request do cliente). O aceite já foi gravado
      pela trigger no mesmo INSERT que cria `auth.users`, então sobrevive ao
      fechamento da aba (mesmo mecanismo que já persiste
      `nome`/`telefone`/`company_name` hoje). Verificado direto no banco local
      (`INSERT INTO auth.users` com e sem `terms_accepted` no metadata).

## Dados e contratos

Nova tabela (migration):

```sql
create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  empresa_id uuid references public.empresas(id),
  terms_version text not null,
  privacy_version text not null,
  source text not null check (source in ('signup', 'profile_setup')),
  accepted_at timestamptz not null default now()
);

create index terms_acceptances_user_id_idx on public.terms_acceptances(user_id);

alter table public.terms_acceptances enable row level security;
-- insert: só o próprio usuário, como a própria linha
-- select: só a própria linha (ou service_role)
-- sem policy de update/delete para authenticated (imutável)
```

Trigger de signup (a mesma que hoje lê `raw_user_meta_data` para criar
`profiles`/`empresas`, ver `supabase/migrations/000_base_schema.sql` e
`012_convites_server_side.sql`) passa a também inserir em
`terms_acceptances` quando `raw_user_meta_data->>'terms_accepted' = 'true'`.

`npm run gen:types` depois da migration (o CI já bloqueia PR com `types.ts`
fora de sync).

Nenhuma RPC nova necessária: leitura "já aceitou?" é uma query direta da
tabela (RLS já limita ao próprio usuário), sem lógica de negócio extra.

## Plano de implementação

Feito (2026-08-18):

1. ✅ Migration `20260843000000_terms_acceptances.sql`: tabela
   `terms_acceptances` + RLS (insert/select só da própria linha, sem
   update/delete) + índice; `handle_new_user()` gravando o aceite no ramo
   self-serve quando o metadata traz `terms_accepted = 'true'`. Aplicada e
   testada no banco local: `INSERT INTO auth.users` com e sem
   `terms_accepted` no metadata, nos dois casos o profile/empresa são criados
   normalmente, e a linha em `terms_acceptances` só aparece quando o metadata
   trouxe o aceite.
2. ✅ `src/schemas/authSchemas.ts`: `termsAccepted` obrigatório (`refine` ===
   true) em `signupSchema`; `profileSetupSchema`/`profileSetupOAuthSchema`
   ganham o campo como opcional (a obrigatoriedade condicional mora no
   componente, não no schema, porque depende de estado carregado do banco).
3. ✅ `src/pages/Signup.tsx`: checkbox com links para `/termos` e
   `/privacidade` (abrem em nova aba); desabilita "Criar conta" via
   `form.formState.isValid` (o `refine` já cobre) e "Continuar com Google" via
   `!termsAccepted` explícito, porque o OAuth não roda a validação do form.
   `handleSignup` passa `terms_accepted`, `terms_version`, `privacy_version`
   em `options.data`. `handleGoogle` não passa nada (o Supabase OAuth não tem
   um equivalente de `options.data` pro fluxo de signup); coberto pelo item 4.
4. ✅ `src/pages/ProfileSetup.tsx`: `loadProfile()` agora também consulta
   `terms_acceptances` por `user_id`; `hasAcceptedTerms` controla se mostra o
   checkbox (fora do bloco `{!pulaSenha && ...}`, cobre Google/convite/
   checkout) ou o aviso "já aceitou"; botão desabilitado enquanto
   `hasAcceptedTerms` é `null` (ainda carregando) ou `false` sem o checkbox
   marcado; `handleUpdate` grava a linha (`source: 'profile_setup'`) antes de
   marcar `onboarding_completed`.
5. ✅ `/termos` publicado (decisão do CEO, 2026-08-18). Ver
   `src/pages/Termos.tsx` e a atualização em `docs/legal/README.md`.
6. ✅ Testes: `src/schemas/authSchemas.test.ts` cobre o `refine` do
   `termsAccepted` em `signupSchema` (aceita/rejeita). Sem teste de
   componente pra Signup/ProfileSetup nem suíte pgTAP pra RLS/trigger nesta
   entrega; cobertura ficou nos testes de schema + verificação manual da
   trigger no banco local.

Pendente antes de considerar isso "Entregue":

- [ ] Migration ainda só está no banco **local**. Falta `npm run
    db:push:staging` e depois `npm run gen:types` (staging) pra fechar o
      `types.ts` canônico, ver `docs/README.md`/ADR 0007. Não fiz isso nesta
      sessão porque mexe em banco compartilhado; decisão de quando promover
      fica com o time.
- [ ] Teste de componente (RTL) pro checkbox em Signup/ProfileSetup, e um
      teste de RLS (pgTAP ou equivalente) confirmando que `user_id != auth.uid()`
      é rejeitado no INSERT; a verificação de hoje foi manual via psql, não
      automatizada.

## Decisões e riscos

- **Dependência resolvida (2026-08-18):** `/termos` já está publicado
  (`src/pages/Termos.tsx`, decisão do CEO), então o checkbox desta spec já tem
  pra onde linkar. Continua pendente: revisão de advogado (o documento nunca
  passou por uma) e o foro/CNPJ, ainda qualificados como "em regularização"
  em vez de dados reais.
- Não abre ADR: o padrão (tabela append-only + RLS insert-only, mesmo desenho
  de `audit_logs`) já é estabelecido no projeto, não é uma decisão
  arquitetural nova.
- Risco aceito: usuários que já têm conta antes deste deploy nunca terão
  registro em `terms_acceptances`. Se isso importar para uma disputa futura,
  a defesa é "aceitou tacitamente ao usar o produto sob os Termos vigentes à
  época", não um registro explícito; mesma situação de praticamente todo
  SaaS que adiciona aceite explícito depois de já ter usuários.
