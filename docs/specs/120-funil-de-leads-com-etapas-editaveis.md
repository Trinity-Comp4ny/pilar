# SPEC 120: Funil de leads com colunas editáveis

**Data:** 2026-10-15  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** gestao (Comercial): leads

## Problema

Sugestão da VRZ (Bruno, 15/10): o Kanban de Leads tem 6 colunas fixas
(`Novo`, `Em contato`, `Proposta`, `Negociação`, `Ganho`, `Perdido`) e o escritório não
consegue renomear, excluir, reordenar nem adicionar colunas. Os boards de Projetos e de
"Meu trabalho" já permitem isso (SPEC 014, `projeto_etapas`).

Hoje a coluna e o comportamento são a mesma coisa: `leads.status` é texto com `CHECK` nos 6
valores e o código age pelo nome ("Ganho" abre a conversão em cliente, "Perdido" pede o
motivo). Renomear a coluna sem separar os dois quebraria a conversão.

## Objetivo

O funil que existe hoje continua como padrão. Cada empresa pode renomear, recolorir,
reordenar, excluir e adicionar colunas, como nos outros funis. Chegar na coluna que conta
como "Ganho" continua convertendo o lead em cliente, e chegar na que conta como "Perdido"
continua pedindo o motivo, qualquer que seja o nome da coluna.

**Fora de escopo:**

- Campos customizados no lead (a VRZ não pediu).
- Mais de um funil por empresa.
- Probabilidade por coluna e automação por coluna.
- Estágio derivado da proposta e "arrastar para Ganho cria projeto" (seguem fora, SPEC 022).

## Requisitos

Mesmo modelo de `projeto_etapas`: cada coluna (`lead_etapas`) tem **nome**, **cor**,
**ordem** e um **`bucket`**, que é um dos 6 status canônicos do lead ("Conta como"). O
`leads.status` passa a **derivar** do bucket da coluna por trigger, então tudo que lê
`status` (KPIs, painel de gestão, dashboard, busca, chat de IA, RPCs de conversão) segue
valendo sem reescrita.

1. Toda empresa tem as 6 colunas padrão, cada uma com o bucket de mesmo nome, na ordem de
   hoje. Nenhum lead muda de coluna na migração.
2. Quem edita Leads (`user_has_feature('leads','editor')`) pode: adicionar coluna (nome, cor
   e "Conta como"), renomear, trocar a cor, mover para esquerda/direita e excluir.
   Quem só vê não vê os controles.
3. Várias colunas podem ter o mesmo bucket (ex.: "Visita técnica" e "Reunião" contando como
   "Em contato").
4. O bucket é definido ao criar a coluna e não muda depois (o banco recusa).
5. Mover um card para uma coluna de bucket `Ganho` segue o fluxo atual: se o lead não tem
   cliente, abre o dialog de conversão (CNPJ, enriquecimento) e cria o cliente; pode pular a
   conversão como hoje. Carimba `convertido_em`. O lead termina na coluna escolhida.
6. Mover para coluna de bucket `Perdido` pede o motivo (obrigatório). Sair de `Perdido`
   limpa o motivo (como hoje).
7. Excluir coluna com leads é recusado com mensagem do que fazer (mover os leads antes). O
   banco também recusa.
8. A última coluna de bucket `Ganho` e a última de bucket `Perdido` não podem ser excluídas.
9. Lead criado por qualquer caminho (formulário, agente `criar_lead`, chat, RPC legada) cai
   na primeira coluna do bucket pedido (`Novo` por padrão). Se não houver coluna desse
   bucket, cai na primeira coluna que não é `Ganho` nem `Perdido`.
10. RPC ou código legado que grava só `leads.status` continua funcionando: a coluna segue a
    primeira coluna daquele bucket (ex.: `rpc_converter_lead_cliente` põe o lead em Ganho).
11. O menu "mover para" do card no mobile lista as colunas da empresa, na ordem.
12. No quadro, lead sem coluna (dado legado) aparece na primeira coluna do bucket do seu
    status, nunca some.

Requisitos não-funcionais:

- **Segurança / RLS:** `lead_etapas` com RLS por `empresa_id`; leitura exige `leads` viewer,
  escrita exige `leads` editor. `leads.etapa_id` só pode apontar para coluna da mesma empresa
  (checado no trigger).
- **Multi-tenant:** isolamento por `empresa_id` mantido.
- **Compatibilidade:** o `CHECK` de `leads.status` e os RPCs `painel_*`, conversão e
  `criar_lead_agente` não mudam.

## Critérios de aceite

- [ ] Dada uma empresa existente, após a migração ela tem 6 colunas e todo lead está na coluna de bucket igual ao seu status.
- [ ] Dada uma empresa nova, quando é criada, então recebe as 6 colunas padrão.
- [ ] Dada a coluna "Ganho" renomeada para "Contrato assinado", quando arrasto um lead sem cliente para ela, então abre o dialog de conversão e, ao confirmar, cria o cliente, carimba `convertido_em` e o lead fica nessa coluna.
- [ ] Dada uma coluna de bucket `Perdido` com outro nome, quando arrasto um lead para ela, então o motivo é obrigatório.
- [ ] Dado `UPDATE leads SET etapa_id = <coluna Ganho>`, então `leads.status` vira `Ganho`.
- [ ] Dado `UPDATE leads SET status = 'Perdido'` (RPC legada), então `etapa_id` vira a primeira coluna de bucket `Perdido`.
- [ ] Dada uma coluna com leads, quando excluo, então a ação é recusada e a mensagem diz para mover os leads.
- [ ] Dada a única coluna de bucket `Ganho`, quando tento excluir, então o banco recusa.
- [ ] Dada uma coluna com bucket `Em contato` criada pelo usuário, quando movo um lead para ela, então `status` fica `Em contato` e os KPIs contam como antes.
- [ ] Caso de borda: alterar o bucket de uma coluna é recusado pelo banco.
- [ ] Caso de borda: usuário só com `leads` viewer não escreve em `lead_etapas` (RLS); outra empresa não lê nem aponta para as colunas.
- [ ] Caso de borda: `leads.etapa_id` de outra empresa é rejeitado.
- [ ] Caso de borda: sem nenhuma coluna de bucket `Novo`, lead novo cai na primeira coluna aberta e o status acompanha.
- [ ] Lead criado pelo agente `criar_lead` entra na coluna `Novo`.
- [ ] `npm run test:run`, `npm run typecheck`, `supabase test db` e o job `types-sync` verdes.

## Dados e contratos

Migration `lead_etapas` (vira `gen:types:local`, commitar `types.ts`):

```sql
create table public.lead_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  cor text,
  bucket text not null default 'Novo'
    check (bucket in ('Novo','Em contato','Proposta','Negociação','Ganho','Perdido')),
  created_at timestamptz not null default now()
);
-- leads.etapa_id uuid references lead_etapas(id) on delete set null
```

- `on delete set null` só alcança leads já excluídos (soft delete): lead ativo na coluna é
  barrado pelo trigger antes.
- Trigger `a_sync_lead_status_etapa` em `leads` (BEFORE INSERT OR UPDATE): deriva
  `status` de `etapa_id` e vice-versa, como `sync_projeto_status_etapa`.
- Trigger em `lead_etapas`: bucket imutável; `BEFORE DELETE` barra coluna com lead ativo e a
  última de `Ganho`/`Perdido` (não barra quando a empresa inteira está sendo apagada).
- Trigger `AFTER INSERT ON empresas` semeia as 6 colunas (padrão de
  `seed_projeto_etapas_padrao`) + backfill idempotente.
- `leads_safe` ganha `etapa_id` (no fim da lista); `GRANT SELECT (etapa_id) ON leads`.

Front:

- `useLeadEtapas` e `useLeadEtapaMutations` espelhando `useProjetoEtapas`.
- `AddColumnInline` (com "Conta como" em `renderExtra`) e `EditColumnDialog` compartilhados.
- Board itera as colunas da empresa; o drop decide por `bucket`.

## Plano de implementação

1. Migration + pgTAP (`SET ROLE authenticated`, porque superuser ignora RLS).
2. `gen:types:local` e `types.ts`.
3. Funções puras testadas: coluna do lead (`etapa_id` ou fallback por status), efeito do drop
   por bucket, regra de exclusão.
4. Hooks `useLeadEtapas` / mutations; `useUpdateLeadStatus` passa a mover por `etapaId`;
   `useConvertLeadToClient` aceita a coluna de destino.
5. Board: colunas vindas do banco, menu da coluna (editar, mover, excluir), "Nova coluna"
   no fim, menu mobile.
6. Lista de leads (`ListaLeads`) mostra o nome da coluna.
7. Conferir `typecheck`, `test:run`, lint e exercitar o fluxo no app.

## Decisões e riscos

- **Mesmo modelo de Projetos** (`bucket` + status derivado): evita reescrever leitores por
  string e mantém o `CHECK`. Vale citar na doc de design do Kanban se virar terceiro uso.
- **Risco:** trigger de sync é o ponto sensível (dois caminhos de escrita: coluna e status).
  Coberto por pgTAP nos dois sentidos.
- **Migration só chega ao staging pelo merge** e precisa ir junto com o front no release: o
  front antigo continua lendo `status` e funciona, mas não enxerga colunas novas.
- **Suposição a confirmar com a VRZ:** que colunas livres no funil único cobrem o pedido.
