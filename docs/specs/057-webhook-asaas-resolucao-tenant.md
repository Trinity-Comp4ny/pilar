# SPEC: Corrigir resolução de tenant no webhook do Asaas

**Data:** 2026-08-19
**Status:** Draft
**Autor:** —
**Módulo:** financeiro (integração Asaas)

## Problema

`supabase/functions/asaas-webhook/index.ts` resolve a empresa (tenant) de um
evento de pagamento consultando `asaas_config.webhook_token` — coluna que foi
**removida** em `028_sync_remote_changes.sql` e nunca voltou a existir. A
consulta falha, o código só lê `data` e ignora `error`, então `configRows` fica
vazio, `resolvedEmpresaId` fica sempre `null`, e o fluxo cai no fallback de
token global **sem restringir a busca de receita por `empresa_id`**:

```ts
let receitaQuery = adminClient.from("receitas").select("id, empresa_id, status").eq("asaas_payment_id", payment.id);
if (resolvedEmpresaId) {
  receitaQuery = receitaQuery.eq("empresa_id", resolvedEmpresaId); // nunca executa hoje
}
```

Achado ao investigar a correção da spec anterior (cifragem da `api_key` do
Asaas, migration `20260850000000`), não é o mesmo bug, é um terceiro lugar
com a mesma causa raiz (referência a coluna morta, erro engolido).

**Severidade real, não inflada:** verificado ao vivo que `asaas_webhook_logs`
tem **uma única linha desde 2026-04-16**, sem `empresa_id` nem `receita_id`
resolvidos. Ou seja, este não é um caminho processando pagamento real hoje —
é um caminho morto. A prioridade de corrigir isto é "antes da primeira
cobrança real passar por aqui", não "produção sangrando agora". Registrar
isso certo evita tratar como incêndio o que é, hoje, uma pré-condição pra
poder cobrar cliente de verdade pelo Asaas.

## Objetivo

Webhook de pagamento do Asaas resolve a empresa correta sem depender de
nenhuma coluna morta, e a checagem de autenticidade do request (é realmente
o Asaas quem está chamando) fica separada, por design, da resolução de
tenant (a qual empresa este pagamento pertence) — hoje as duas coisas
estavam acopladas na mesma variável (`webhook_token` fazia autenticação E
identificação ao mesmo tempo), o que foi parte do que quebrou em silêncio.

**Fora de escopo:**

- Reautenticar/validar o fluxo de criação de cobrança
  (`asaas-criar-cobranca`), que já está correto e é a fonte do dado que esta
  spec passa a usar.
- Qualquer mudança de UI. A tela de configuração do Asaas
  (`AsaasConfigForm.tsx`) já não expõe mais token de webhook por empresa
  desde a spec anterior.
- Reintroduzir a coluna `webhook_token` "porque era assim antes" sem
  justificar — ver Decisões e riscos.

## Requisitos

1. **Resolução de tenant por dado do próprio pagamento, não por segredo
   configurado à parte.** `asaas-criar-cobranca` já grava
   `externalReference: receita.id` ao criar a cobrança
   (`supabase/functions/asaas-criar-cobranca/index.ts:140`). O webhook busca
   a `receita` por **duas** chaves em conjunto — `asaas_payment_id =
payment.id` **e** `id = payment.externalReference` — e só considera
   resolvido se as duas apontarem pra mesma linha. Isso não depende de
   nenhuma coluna que possa ser removida por engano em outra migration sem
   quebrar visivelmente (um teste pgTAP cobre isso, requisito 4).
2. **Autenticidade do request vira decisão própria, documentada**, não
   subproduto de "encontrou a empresa". Duas opções, escolher uma na revisão
   desta spec antes de implementar (ver Decisões e riscos):
   - (a) manter `ASAAS_WEBHOOK_TOKEN` único por plataforma, o mesmo valor
     configurado no painel Asaas de toda empresa cliente, documentado
     explicitamente como secret compartilhado de baixo risco (não é
     credencial de tenant, é filtro de tráfego não-Asaas); ou
   - (b) reintroduzir um token por empresa de verdade, desta vez com teste
     pgTAP e E2E cobrindo o caminho, pra não repetir o apodrecimento
     silencioso que motivou esta spec.
3. Se a receita não for encontrada pela dupla chave do requisito 1, o evento
   é logado em `asaas_webhook_logs` com `empresa_id NULL` (rastreável, não
   descartado) e a resposta ainda é `200` pro Asaas não ficar re-tentando
   indefinidamente um evento que nunca vai casar.
4. Teste pgTAP ou de integração cobrindo: evento com `externalReference`
   batendo com uma receita real resolve a empresa certa; evento com
   `externalReference` de uma empresa e `asaas_payment_id` de outra (payload
   adulterado) **não** resolve nenhuma (as duas chaves têm que bater na
   mesma linha, não bastar uma).
5. Remover a consulta morta a `asaas_config.webhook_token` e o loop de
   comparação em memória que ela alimentava.

Requisitos não-funcionais:

- **Segurança / RLS:** a função já usa `service_role` (bypassa RLS por
  design, é chamada pelo Asaas sem JWT de usuário). O isolamento de tenant
  aqui é responsabilidade da lógica da função, não de RLS — por isso o
  requisito 4 exige teste cobrindo especificamente o caso de payload
  adulterado tentando cruzar tenant.
- **Idempotência:** já existe índice único em `(event, payment_id)` em
  `asaas_webhook_logs` tratando reprocessamento como noop — preservar esse
  comportamento, não é objeto desta spec.
- **Compatibilidade:** cobrança criada **antes** desta correção não tem
  `externalReference` de propósito diferente (já é `receita.id` desde que
  `asaas-criar-cobranca` existe), então não há migração de dado histórico
  necessária.

## Critérios de aceite

- [ ] Dado um evento de pagamento do Asaas com `externalReference` igual ao
      `id` de uma receita real e `payment.id` igual ao `asaas_payment_id`
      gravado nessa mesma receita, quando o webhook processa, então resolve
      `empresa_id` da receita correta e atualiza o status.
- [ ] Dado um evento com `payment.id` de uma receita da empresa A mas
      `externalReference` apontando pra uma receita da empresa B (payload
      adulterado ou erro de integração), quando o webhook processa, então
      **não** resolve nenhuma empresa e o evento é logado com `empresa_id
    NULL`, não com a empresa errada.
- [ ] Dado um evento sem correspondência em nenhuma receita, quando o
      webhook processa, então responde `200` (não gera retry infinito do
      Asaas) e loga o evento com `empresa_id NULL`.
- [ ] Caso de borda: dado um evento que já foi processado antes (mesmo
      `event` + `payment_id`), quando chega de novo, então é tratado como
      noop pelo índice único existente, sem duplicar efeito.
- [ ] Verificação de fechamento: `grep -rn "webhook_token" supabase/functions/`
      não retorna nenhuma ocorrência depois desta spec implementada (nem em
      `asaas-webhook`, nem resíduo em nenhum outro lugar).

## Dados e contratos

- Sem coluna nova. `asaas_webhook_logs.empresa_id` já é nullable, comporta o
  requisito 3 sem migration.
- Se a opção (b) do requisito 2 for escolhida: precisa de coluna nova (nome
  a definir, não reusar `webhook_token` pra não confundir com o mecanismo
  morto) mais `npm run gen:types`.
- Sem mudança de shape de resposta HTTP do webhook.

## Plano de implementação

1. Decidir a opção do requisito 2 (autenticidade: secret único de
   plataforma vs. secret por empresa) — bloqueia o resto, é decisão de
   produto/segurança, não técnica.
2. Reescrever a resolução de tenant em `asaas-webhook/index.ts` pela dupla
   chave do requisito 1, removendo a consulta a `asaas_config.webhook_token`.
3. Escrever o teste do requisito 4 (caso feliz + payload adulterado).
4. Rodar em staging com um evento de teste do próprio Asaas sandbox antes de
   promover, já que hoje não há nenhum evento real recente pra validar
   contra produção.

## Decisões e riscos

- **Por que não simplesmente restaurar `webhook_token`:** o desenho antigo
  fazia autenticação e identificação de tenant com o mesmo valor, e ficou
  quebrado por meses sem ninguém perceber justamente porque nada testava
  esse caminho (0 eventos reais no período). Separar as duas
  responsabilidades (requisito 1 resolve tenant pelo dado do pagamento,
  requisito 2 resolve autenticidade à parte) é mais robusto a esse mesmo
  tipo de apodrecimento silencioso se uma das duas quebrar de novo no
  futuro — a outra continua funcionando.
- **Risco assumido:** a resolução por `externalReference` confia que
  `asaas-criar-cobranca` é o único caminho que cria cobrança com
  `externalReference` preenchido corretamente. Se um dia existir criação de
  cobrança por outro caminho (importação manual, script, etc.) sem seguir
  essa convenção, o webhook correspondente não resolve tenant. Aceitável
  porque hoje só existe um caminho de criação.
- **Não vira ADR:** é correção de um mecanismo quebrado, não mudança de
  arquitetura de tenancy (RLS/multi-tenant continua exatamente como é, ADR
  0001 não muda).
