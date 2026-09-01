# SPEC: Upload de foto de perfil

**Data:** 2026-08-31
**Status:** Entregue (local, verificado em 2026-09-01; pendente promover a migration pra staging/main)
**Autor:** —
**Módulo:** configurações (Conta) / pessoas

## Problema

Hoje só existe foto de perfil para quem loga via Google (avatar sincronizado
automaticamente, ver `handle_new_user` e `AuthCallback.tsx`). Quem entra por
email/senha nunca tem `avatar_url`, e quem loga via Google não tem como trocar
ou remover a foto puxada da conta Google. O `AvatarStack` (`src/components/AvatarStack.tsx`)
já sabe mostrar foto quando `avatarUrl` existe e cai para iniciais quando não
existe ou falha ao carregar — falta o caminho manual de upload.

## Objetivo

Usuário autenticado consegue subir, trocar e remover a própria foto de perfil
em Configurações → Conta, e essa foto passa a aparecer em todo lugar que já lê
`profiles.avatar_url` via `usePessoasEmpresa` (seletor de responsável no board
de Meu Trabalho, filtro de pessoa, etc.).

**Fora de escopo:**

- Crop/recorte da imagem no cliente (upload direto; `object-cover` já centraliza).
- Propagar a foto para telas cujo nome de responsável vem denormalizado de RPC/view
  (Portal Cliente `get_cliente_projeto_detail*`, Cronograma/Disciplinas, cards de
  tarefa via RPC — ~10 pontos levantados nesta sessão). Essas continuam mostrando
  só iniciais até uma fase 2 dedicada a tocar cada RPC.
- Foto de outra pessoa (ex. admin subindo foto de um colega): só o próprio dono edita.
- Avatar para `pessoas` sem login (`profile_id is null`): não há onde guardar nem exibir.

## Requisitos

1. Em Configurações → Conta (`ContaPanel.tsx`), o usuário vê a foto atual (foto
   real ou iniciais via `AvatarStack`) com opção de trocar ou remover.
2. Ao escolher um arquivo válido (PNG/JPG/WebP, máx. 2MB — mesmo limite do logo
   de empresa em `EmpresaPanel.tsx`), o arquivo é enviado para o bucket
   `user-avatars` e `profiles.avatar_url` é atualizado com a URL pública.
3. A UI reflete a nova foto imediatamente, sem exigir recarregar a página.
4. Usuário pode remover a foto atual: `avatar_url` volta a `NULL` e o avatar volta
   a mostrar iniciais.
5. Arquivo de tipo ou tamanho inválido é rejeitado no cliente, com mensagem clara,
   antes de qualquer tentativa de upload.
6. Upload manual sempre prevalece sobre o valor sincronizado automaticamente do
   Google: depois de um upload manual, um novo login Google não deve sobrescrever
   a foto escolhida pelo usuário (ver decisão abaixo).

Requisitos não-funcionais:

- **Segurança / RLS:** bucket `user-avatars` com policies de INSERT/UPDATE/DELETE
  em `storage.objects` restritas a `(split_part(name, '/', 1))::uuid = auth.uid()`
  — mesmo padrão de `"Company logos admin write/update/delete"` (migration
  `20260504700000_cleanup_user_role_enum.sql`), mas por usuário, não por admin+empresa.
  Leitura pública (bucket `public = true`), como `company-logos`, para o `<img>` do
  `AvatarStack` funcionar sem signed URL em toda tela que lista pessoas.
- **Multi-tenant:** path do arquivo prefixado pelo `auth.uid()` já isola por usuário;
  não depende de `empresa_id` porque o dono do arquivo é sempre o próprio usuário.
- **Performance:** path fixo por usuário (`{user_id}/avatar`, sem extensão — o
  `Content-Type` vem do próprio `File` no upload) com `upsert: true`, para não
  acumular lixo no bucket a cada troca. Cache-busting via querystring `?v={timestamp}`
  gravada junto na própria `avatar_url` (não no nome do arquivo, que ficaria órfão
  a cada troca).

## Critérios de aceite

- [x] Dado usuário sem foto, quando sobe um PNG de 500KB, então `avatar_url` é
      atualizada e o `AvatarStack` mostra a foto (verificado: ContaPanel e sidebar;
      Meu Trabalho ainda não exercido manualmente).
- [ ] Dado usuário com foto, quando clica "remover foto", então `avatar_url` volta
      a `NULL` e o avatar volta a mostrar iniciais nos mesmos lugares.
- [ ] Dado arquivo de 5MB, quando tenta subir, então erro "Arquivo muito grande" e
      nada é enviado ao bucket.
- [ ] Dado arquivo `.pdf`, quando tenta subir, então erro "Formato inválido" e nada
      é enviado.
- [ ] Dado usuário A autenticado, quando tenta fazer upload/update/delete direto na
      API para um path prefixado pelo `auth.uid()` de outro usuário, então a RLS
      de `storage.objects` rejeita.
- [ ] Dado usuário logado via Google com `avatar_url` preenchida pelo trigger/
      `AuthCallback`, quando sobe uma foto manual, então a manual prevalece e um
      login Google seguinte não a sobrescreve.

## Dados e contratos

- Bucket novo `user-avatars` (migration, `public = true`) — **tracked desde o
  início**: `company-logos` foi criado fora de migration (achado ao levantar esta
  spec, não há `INSERT INTO storage.buckets` para ele no repo), o que é o mesmo
  padrão de drift descrito em `docs/` sobre migrations órfãs; não repetir aqui.
- Policies em `storage.objects` (INSERT/UPDATE/DELETE) para `bucket_id = 'user-avatars'`
  com `(split_part(name, '/', 1))::uuid = auth.uid()`.
- `profiles.avatar_url` (já existe, sem migration de schema) passa a ser escrito
  também direto pelo client (hoje só o trigger `handle_new_user` e o
  `AuthCallback.tsx` escrevem nela).
- Sem RPC nova: upload e update de `profiles` via client (`supabase.storage` +
  `supabase.from("profiles").update(...)`, mesmo padrão do `uploadCompanyLogo` em
  `EmpresaPanel.tsx`), protegido pela RLS acima em vez de uma edge function.

## Plano de implementação

Preenchido junto com o agente (plan mode) e aprovado antes de gerar código.

1. Migration: bucket `user-avatars` + policies de `storage.objects`.
2. Lógica inline em `ContaPanel.tsx`: valida tipo/tamanho, sobe pro path fixo
   `{user_id}/avatar` (upsert), `getPublicUrl` + `?v={timestamp}`, `update` em
   `profiles`, invalida o cache do React Query de `usePessoasEmpresa`
   (`PESSOAS_EMPRESA_QUERY_KEY`).
3. UI em `ContaPanel.tsx`: seção "Foto de perfil" com `AvatarStack` (preview),
   input de arquivo e botão "Remover foto".
4. Sem mudança em `types.ts` (nenhuma coluna nova).
5. Verificação manual: upload, troca, remoção, arquivo inválido, e — via SQL
   direto ou um segundo usuário de teste — a RLS barrando upload no path alheio.

## Decisões e riscos

- **Decidido (2026-09-01):** bucket público. Mesmo racional do `company-logos` já em
  produção; foto de perfil não é dado sensível e evita renovar signed URL em toda
  tela que usa `AvatarStack`.
- **Decidido (2026-09-01, requisito 6):** sem coluna nova. `AuthCallback.tsx` só
  grava `avatar_url` do Google via `UPDATE ... WHERE avatar_url IS NULL` — upload
  manual sempre preenche o campo, então nunca mais é sobrescrito por um login
  Google seguinte. Trade-off aceito: se o usuário remover a foto manual, o próximo
  login Google volta a preencher com a foto do Google (comportamento correto pelo
  pedido do CEO: "se não tem foto e conectou com o Google, pode puxar a do Google").
- **Risco conhecido (fase 2, fora de escopo aqui):** ~10 RPCs/views devolvem nome de
  responsável denormalizado sem `avatar_url` (Portal Cliente incluso). Levantamento
  completo fica pendente para quando essa fase for priorizada.
