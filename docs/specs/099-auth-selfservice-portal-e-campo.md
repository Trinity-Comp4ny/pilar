# SPEC: Auth self-service do Portal do Cliente e do Pilar Campo

**Data:** 2026-09-08
**Status:** Draft
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** Portal Cliente, Pilar Campo

<!-- Origem: investigação do sistema de login dos dois portais, a pedido do Matheus. -->

## Problema

Hoje, tanto o Portal do Cliente quanto o Pilar Campo seguem o mesmo desenho: o gestor do
escritório gera uma senha e a entrega (por email, no caso do portal; copiando na tela, no
caso do campo). Isso tem três consequências:

1. **A senha viaja em texto puro.** O convite e o reset de senha do portal mandam a senha
   em claro por email (`supabase/functions/invite-cliente-portal`,
   `reset-cliente-portal-password`); ela fica legível na caixa de entrada do cliente
   indefinidamente.
2. **Não existe gestão de acesso do Pilar Campo.** `CriarAcessoCampoDialog.tsx` só cria
   credencial nova; não há tela que liste quem já tem acesso a uma obra, nem forma de
   revogar. Se alguém sai da obra, o acesso continua ativo.
3. **A listagem de Clientes não mostra quem tem acesso ao portal.** Essa informação só
   existe na tela de detalhe de cada cliente (`clientes/[id]/index.tsx`); não há coluna nem
   filtro na lista (`clientes/index.tsx`).

## Objetivo

Trocar "gestor gera e entrega a senha" por "gestor convida, o próprio dono da conta define
a senha" sempre que houver um canal confiável de entrega (email real). Fechar as duas
lacunas de gestão de acesso (Campo e listagem de Clientes).

## Fora de escopo

- **Níveis/papéis dentro do Pilar Campo** (ex: mestre de obra vs. ajudante). Avaliado e
  descartado nesta rodada: hoje nenhuma ação distingue contas de campo entre si, e não há
  necessidade de negócio identificada para diferenciar permissão agora. Se aparecer,
  entra depois como spec própria.
- **Self-service sem fallback no Pilar Campo.** A decisão do CEO na spec 042 continua de
  pé: o pedreiro pode não ter email confiável. Convite por link só roda quando o gestor
  informa um email real; sem email, o fluxo atual (gestor gera senha e entrega na mão)
  continua existindo.
- **Qualquer mudança no Supabase Auth do pessoal do escritório.** Esta spec cobre só as
  duas contas "espelho" (`cliente_portal_accounts`, `campo_accounts`).
- **Timeline do projeto e notificação de eventos do cliente** (aprovação de proposta,
  aprovação/revisão de entrega). Isso é tratado como extensão da spec 093, não aqui — são
  temas independentes que só coincidem em estarem no Portal do Cliente.
- **Auditoria de login (sucesso/falha, IP, histórico).** Levantado na investigação anterior
  como oportunidade, mas não bloqueia esta spec; fica como fast-follow.

## Requisitos

### Convite por link (Portal do Cliente)

1. `invite-cliente-portal` deixa de gerar e devolver uma senha. Em vez disso, gera um
   **token de convite** de uso único (32 bytes aleatórios, hash SHA256 armazenado, nunca em
   claro), grava em `cliente_portal_accounts` e manda por email um link
   `/cliente/convite?token=...`.
2. O convite expira em **72 horas**. Convite expirado: o cliente vê mensagem clara e o
   gestor pode gerar um novo (reenviar), sem precisar de suporte.
3. Tela nova `/cliente/convite`: cliente define a própria senha (política já existente,
   `passwordSchema`: 12+ caracteres com maiúscula/minúscula/número/especial). Ao salvar, o
   token é consumido (marcado usado, não reutilizável) e a conta fica ativa — sem exigir
   troca de senha depois (o requisito de "must_change_password" deixa de existir para
   contas criadas por este fluxo, já que a senha já nasce definida pelo próprio dono).
4. `reset-cliente-portal-password` segue o mesmo mecanismo: gera novo convite de
   redefinição em vez de nova senha em claro. O texto do email muda de "sua senha é X" para
   "clique para definir uma nova senha".
5. Rate limit na rota pública de definir senha por token: **10 tentativas / 15 min por IP**
   (o token já é de alta entropia; o limite aqui é contra automação abusiva da rota, não
   contra adivinhação do token).

### Convite por link com fallback (Pilar Campo)

6. `email` deixa de ser obrigatório em `CriarAcessoCampoDialog`. Campo continua pedindo
   nome; email vira opcional com texto explicando a diferença de fluxo.
7. **Com email informado**: `invite-campo` manda convite por link, mesmo mecanismo do
   portal (token de convite, 72h, tela de definir senha própria — reaproveita
   `/campo/convite`, espelhando `/cliente/convite`).
8. **Sem email**: mantém o fluxo atual — a edge gera a senha, devolve na resposta, a UI
   mostra uma vez pro gestor copiar e entregar na mão. `email` neste caso é preenchido
   internamente com um placeholder não endereçável (como já ocorre hoje), só para
   satisfazer a constraint de unicidade da tabela.
9. O dialog mostra qual dos dois caminhos foi tomado ("Convite enviado para
   fulano@email.com" vs. "Anote a senha, ela só aparece uma vez") para o gestor não ficar
   em dúvida se precisa entregar algo na mão ou não.

### Gestão de acesso do Pilar Campo

10. Nova aba/seção **"Acessos"** dentro da tela de Obra: lista as contas de campo daquela
    obra — nome, email (ou "sem email"), status (ativo/revogado), último acesso.
11. Ação de **revogar** por conta (`ativo = false`), mesmo padrão do
    `revokePortalMutation` do portal. Revogar invalida a sessão corrente (o próximo
    `campo_verify_session` daquela conta retorna `ok: false`, mesmo com token ainda não
    expirado).
12. Reemitir acesso para quem já tem conta revogada gera um novo convite/senha, não uma
    segunda linha na tabela (mesmo email, mesma obra).

### Visibilidade de acesso ao portal (listagem de Clientes)

13. A listagem de Clientes (`clientes/index.tsx`) ganha uma coluna/badge "Portal: ativo /
    convite pendente / sem acesso" — os três estados diferenciam de um "sim/não" simples
    porque, com convite, existe o estado intermediário de convite mandado e ainda não
    aceito.
14. Filtro por esse estado na mesma tela.

## Não-funcionais

- **Segurança:** token de convite com a mesma robustez do token de sessão já existente —
  32 bytes aleatórios, hash SHA256 armazenado, comparação sempre pelo hash (não repetir o
  bug histórico de comparar token em claro). Expiração curta (72h) porque, ao contrário do
  token de sessão, este não deveria viver semanas.
- **RLS/tenant:** as novas RPCs (`campo_listar_contas_obra`, `campo_revogar_acesso`,
  `portal_convite_definir_senha`, `campo_convite_definir_senha`) são `SECURITY DEFINER` com
  check de tenant explícito no corpo, seguindo o padrão de `campo_salvar_rdo`. Listar e
  revogar contas de campo é restrito às mesmas roles que já criam acesso hoje
  (`admin`/`ultra_admin`/`owner`/`coordenador`).
- **Rate limit:** reaproveita `check_rate_limit`, mesma função usada em `portal_login`.
- **Email:** o template `templateAcessoPortalCliente` (e o equivalente do campo) muda de
  "aqui está sua senha" para "clique para criar sua senha"; texto sem jargão, direto.

## Critérios de aceite

- [ ] Dado um cliente convidado, quando ele abre o link dentro de 72h e define uma senha
      válida, então consegue entrar no portal imediatamente com essa senha.
- [ ] Dado um convite expirado, quando o cliente abre o link, então vê mensagem clara e o
      gestor consegue reenviar um novo convite pelo mesmo lugar de sempre.
- [ ] Dado um token de convite já usado, quando alguém tenta reutilizá-lo, então a operação
      falha (token não é reutilizável).
- [ ] Dado um acesso de campo criado **com** email, quando o gestor confirma, então o
      funcionário recebe um link e define a própria senha; a tela não mostra senha nenhuma.
- [ ] Dado um acesso de campo criado **sem** email, quando o gestor confirma, então o
      comportamento é idêntico ao atual (senha mostrada uma vez na tela).
- [ ] Dado um acesso de campo revogado, quando essa conta tenta `campo_verify_session` com
      o token antigo, então recebe `ok: false`, mesmo que o token não tenha expirado.
- [ ] Dado um usuário de uma empresa, quando abre a aba Acessos de uma obra de **outra**
      empresa, então recebe erro de permissão (tenant check).
- [ ] Dado um cliente sem conta de portal, quando o escritório olha a listagem de Clientes,
      então vê "sem acesso" nessa linha, e o filtro por esse estado retorna esse cliente.
- [ ] Caso de borda: gestor reemite acesso pra uma conta de campo já revogada — não cria
      linha duplicada, reativa/atualiza a existente.

## Dados e contratos

**`cliente_portal_accounts`** ganha:

| coluna               | tipo             | nota                                                                  |
| -------------------- | ---------------- | --------------------------------------------------------------------- |
| `convite_token_hash` | text null        | sha256 do token de convite ativo; null quando não há convite pendente |
| `convite_expira_em`  | timestamptz null | 72h a partir da geração                                               |

**`campo_accounts`** ganha as mesmas duas colunas, mesmo padrão.

**RPCs novas:**

- `portal_convite_definir_senha(p_token text, p_senha text) returns json` — valida hash e
  expiração, seta `senha_hash`, limpa as colunas de convite, retorna `{ ok, token, nome }`
  (token de sessão já pronto pra logar direto, sem exigir novo login).
- `campo_convite_definir_senha(p_token text, p_senha text) returns json` — espelha a acima.
- `campo_listar_contas_obra(p_obra_id uuid) returns setof json` — nome, email, ativo,
  ultimo_acesso; tenant check via `obras.empresa_id`.
- `campo_revogar_acesso(p_account_id uuid) returns void` — seta `ativo = false`; tenant
  check via join até `obras`.

**Edge functions alteradas:** `invite-cliente-portal`, `reset-cliente-portal-password`,
`invite-campo` (email agora opcional no payload).

## Plano de implementação

A preencher em plan mode antes de gerar código. Ordem pretendida:

1. Migration: colunas de convite nas duas tabelas + as 4 RPCs novas + RLS.
2. Ajustar as 3 edge functions (gerar convite em vez de senha, quando aplicável).
3. `gen:types:local`, pgTAP: convite válido, expirado, reutilizado, tenant errado, revogação
   invalida sessão ativa.
4. UI: `/cliente/convite` e `/campo/convite` (telas de definir senha).
5. UI: aba Acessos na Obra (lista + revogar).
6. UI: `CriarAcessoCampoDialog` (email opcional, duas mensagens de resultado).
7. UI: coluna/badge + filtro na listagem de Clientes.
8. Atualizar templates de email.

## Decisões e riscos

- **Tabelas continuam separadas, sem tabela de convite compartilhada.** Portal e Campo já
  são sistemas espelhados, não compartilhados (cada um sua tabela, suas RPCs). Manter esse
  padrão evita acoplar dois domínios que hoje evoluem independente.
- **Sem níveis no Campo — decisão consciente, não esquecimento.** Levantado e descartado
  nesta rodada: nenhuma ação hoje distinguiria mestre de obra de ajudante.
- **Fallback do Campo não é temporário.** Diferente de uma migração transitória, o caminho
  "sem email" continua existindo por tempo indeterminado — é a realidade de parte do ICP
  (pedreiro/servente), não uma dívida técnica a eliminar depois.
- **Contas de campo com senha temporária pré-existentes** (criadas antes desta spec) não
  são migradas automaticamente para o modelo de convite; continuam funcionando como estão
  até o próximo reset.
- **Política de senha do Campo (8+, sem exigir complexidade) é mais fraca que a do Portal
  (12+, com maiúscula/minúscula/número/especial) mesmo no fluxo por convite.** Decisão
  consciente, não descuido (levantado pelo rls-auditor na revisão desta migration): o
  fallback sem e-mail já usa senha de 8 caracteres, pensado para alguém sem e-mail digitar
  na mão; manter os dois caminhos do Campo com a mesma regra evita o funcionário cair numa
  política diferente dependendo de ter ou não e-mail cadastrado.
- **Rate limit das rotas públicas de completar convite tem um bucket de fallback quando o
  cabeçalho de IP não vem** (achado do rls-auditor): em vez de ficar sem nenhuma trava
  nesse caso, cai numa chave compartilhada (`sem_ip_conhecido`) com limite mais apertado
  (30/900s contra 10/900s por IP). Não é proteção perfeita (é um bucket global, não por
  cliente), mas fecha a lacuna de "sem IP = sem limite nenhum".
