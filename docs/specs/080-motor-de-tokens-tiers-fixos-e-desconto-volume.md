# SPEC: Motor de tokens — tiers fixos de compra com desconto por volume

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Redesenha o fluxo de compra da [SPEC 079](079-motor-de-tokens-compra-na-ui.md), reagindo a
> feedback direto do CEO testando em staging: quantidade livre + radio de pagamento "ficou
> muito ruim" perto do padrão de mercado. Preços fixados em DECISOES.md 2026-09-01.

## Problema

O formulário de compra (campo numérico 1-20 + radio Pix/Boleto) não parece um fluxo de
compra sério — falta o padrão que OpenAI/Anthropic Console já validaram: tiers fixos como
cartões clicáveis, preço por unidade caindo no tier maior.

## Objetivo

Cliente escolhe entre 4 tiers de tokens (cartões, não campo numérico), com desconto por
volume visível, e forma de pagamento como toggle Pix/Boleto (não radio com texto).

**Fora de escopo:**
- Cartão de crédito (mesmo corte da spec 079).
- Tier customizado/quantidade livre acima do maior tier — se um cliente precisar de mais
  que 6M de tokens avulsos, é caso de suporte manual, não fluxo self-serve (ainda).
- Mudar o tamanho/preço do tier 1 (R$49/500k) — DECISOES.md mantém esse ponto fixo.

## Requisitos

Funcionais:

1. Catálogo de 4 tiers hardcoded no backend (`pilar-token-pack-create`), nunca aceita
   preço/tokens vindos do cliente — só o `tier_id`:
   - `starter`: 500.000 tokens, R$49,00
   - `cresce`: 1.500.000 tokens, R$129,00
   - `escala`: 3.000.000 tokens, R$228,00
   - `maximo`: 6.000.000 tokens, R$399,00
2. `pilar-token-pack-create` aceita `{ tier_id, billing_type }` (troca `quantidade_pacotes`
   por `tier_id`); resolve tokens/valor pelo catálogo do servidor; `tier_id` inválido → 400.
3. `pilar_token_pack_purchases` grava o `tier_id` (nova coluna, informativa) e continua
   gravando `tokens_pacote` = tokens totais do tier escolhido, `quantidade_pacotes = 1`
   (sempre — o conceito de "N pacotes de tamanho fixo" morre aqui, vira "1 compra de 1
   tier"). Isso preserva o webhook de crédito **sem nenhuma mudança**: a conta
   `quantidade_pacotes * tokens_pacote` já dá o total certo.
4. UI (`ComprarTokensDialog`): 4 cards de tier (tokens, preço, R$/milhão, badge de
   desconto no tier ≥ 2), seleção única; forma de pagamento como toggle de 2 botões
   (Pix pré-selecionado, Boleto ao lado) — não radio com label ao lado do círculo.
5. Extrato/painel de margem que já leem `pilar_token_pack_purchases` continuam
   funcionando sem mudança (usam `valor_centavos`/`tokens_pacote`, não o tier em si).

Não-funcionais:

- **Sem confiar no cliente:** preço e quantidade de tokens SEMPRE resolvidos no backend a
  partir do `tier_id`; o valor que o front mostra é só exibição.

## Critérios de aceite

- [ ] Dado o dialog aberto, quando carrega, então mostra 4 cards com tokens, preço e
      R$/milhão de cada tier, sem nenhum campo numérico de quantidade.
- [ ] Dado um tier selecionado e Pix como forma de pagamento, quando confirma, então cria
      a cobrança com o valor exato do catálogo do backend (não o que o front calculou).
- [ ] Dado um `tier_id` inexistente enviado direto pra function (bypass da UI), então
      recebe 400 sem tocar no Asaas.
- [ ] Dado o tier `maximo` pago, quando o webhook processa, então credita exatamente
      6.000.000 tokens (mesma lógica de crédito da SPEC 077, sem mudança no webhook).

## Dados e contratos

- **Migration:** `ALTER TABLE pilar_token_pack_purchases ADD COLUMN tier_id text;`
  (informativa, sem CHECK rígido — o catálogo pode evoluir sem migration nova).
- **`pilar-token-pack-create`:** payload novo `{ tier_id: string, billing_type }`.
- **Sem mudança** em `pilar-checkout-webhook`, `ai_token_ledger`, RLS.

## Plano de implementação

1. Migration: coluna `tier_id`.
2. `pilar-token-pack-create/index.ts`: catálogo de tiers, troca `quantidade_pacotes` por
   `tier_id`.
3. `useTokenPackCreate.ts`: payload novo.
4. `ComprarTokensDialog.tsx`: cards de tier + toggle de pagamento, remove o campo numérico
   e o `RadioGroup`.
5. `MOTOR_DE_TOKENS.md` §3: atualizar a tabela de preços com os 4 tiers.
6. Testar manualmente em staging (mesmo método das fases anteriores: `vite preview` na
   porta liberada no CORS).

## Decisões e riscos

- Decisão de pricing registrada em DECISOES.md 2026-09-01 (desconto por volume).
- Risco: cliente que já tinha o hábito do fluxo antigo (quantidade livre) estranha o corte
  em 4 tiers — aceito, é a primeira semana do recurso, sem cliente pagante de verdade ainda
  usando compra avulsa.
