# SPEC: Motor de tokens — checkout em página própria, com cartão de crédito

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Segunda iteração de UX sobre a [SPEC 080](080-motor-de-tokens-tiers-fixos-e-desconto-volume.md),
> reagindo a feedback direto do CEO: (1) remover o "R$/milhão" dos cards, (2) forma de
> pagamento não pertence ao mesmo passo da escolha do tier — vira uma página de checkout
> própria, com cartão de crédito como opção nova.

## Problema

O modal atual resolve a escolha do tier, mas empilha pagamento no mesmo passo — o cliente
que troca de forma de pagamento ou de tier não tem espaço pra decidir com calma, e cartão
de crédito (a forma mais comum de recarga rápida em produtos internacionais) nem existe
ainda no fluxo, mesmo já suportado pelo backend desde a SPEC 077.

## Objetivo

Cliente clica "Comprar mais" na aba Uso, cai numa página de checkout dedicada
(`/comprar-tokens`) que mostra os 4 tiers (sem R$/milhão) e o formulário de pagamento
lado a lado — Pix, Boleto ou Cartão de crédito — no mesmo padrão visual do checkout
público de assinatura (`/checkout`).

**Fora de escopo:**
- Salvar cartão pra recompra com 1 clique (Asaas tokenization) — fica pra quando houver
  volume real de uso desse caminho.
- Mudar o valor/tokens dos tiers (só o preço/milhão some da UI, os números da SPEC 080
  continuam os mesmos).
- Fluxo de assinatura recorrente de tokens (isso é o pacote avulso, sempre pontual).

## Requisitos

Funcionais:

1. Nova rota autenticada `/comprar-tokens` (dentro de `PrivateRoute`, sem gate de feature —
   qualquer admin/ultra_admin da empresa acessa). `UsoPanel.tsx` troca o botão "Comprar
   mais" de abrir dialog para `navigate("/comprar-tokens")` (fecha o modal de Configurações
   antes de navegar).
2. Layout de duas colunas (mesmo padrão do `/checkout` público): coluna principal com
   forma de pagamento; coluna lateral fixa com os 4 tiers como lista selecionável
   (tokens + preço + badge de desconto, **sem** R$/milhão) e o total a pagar.
3. Forma de pagamento como 3 botões com ícone (Cartão/Pix/Boleto), reaproveitando o padrão
   visual de `CheckoutForm.tsx` (não o toggle de 2 botões da SPEC 080 — cartão entra como
   terceira opção igual).
4. Cartão de crédito: campos de número/validade/CVV/nome impresso (com detecção de
   bandeira e Luhn, mesma validação client-side do checkout público) + CEP/número do
   endereço de cobrança (Asaas exige). Nome e email do titular vêm pré-preenchidos do
   perfil logado (`profile.first_name/last_name/email`), CPF/CNPJ pré-preenchido do CNPJ
   da empresa se existir (`empresas.cnpj`), editável.
5. Pix/Boleto: sem campos extra (a empresa já tem `asaas_customer_id` no Asaas desde a
   assinatura) — só o botão de confirmar.
6. Ao confirmar, `pilar-token-pack-create` (sem mudança de contrato — já aceitava
   `CREDIT_CARD` desde a SPEC 077) processa; página troca para o estágio de pagamento:
   - Cartão: cobrança é síncrona — se `payment_status` já vier `paid`, mostra sucesso na
     hora (sem esperar polling).
   - Pix/Boleto: mostra QR/linha digitável (reaproveita `PixPayment`/`BoletoPayment` sem
     alteração) com o mesmo polling da SPEC 079.
7. Tela de sucesso tem botão "Voltar ao Pilar" (`navigate("/inicio")` ou de volta pra
   última rota) — sem forçar reload, o saldo já reflete no próximo `Configurações > Uso`.

Não-funcionais:

- **Reuso:** validação de cartão (Luhn, bandeira, máscaras) e `PixPayment`/`BoletoPayment`
  duplicados a partir do checkout público por escolha — 2º uso, não vira componente
  compartilhado ainda (regra dos 3 usos do design system).
- **Sem mudança de contrato no backend:** `pilar-token-pack-create` já aceita
  `credit_card`/`credit_card_holder_info` desde a SPEC 077; esta spec só liga isso na UI.

## Critérios de aceite

- [ ] Dado o admin na aba Uso, quando clica "Comprar mais", então é levado pra
      `/comprar-tokens` (modal de Configurações fecha).
- [ ] Dado os cards de tier na página, quando renderizam, então mostram tokens, preço e
      desconto — **sem** "R$/milhão" em nenhum lugar.
- [ ] Dado Cartão selecionado, quando preenche os dados e confirma, então a cobrança usa
      exatamente `valorCentavos` do tier resolvido no backend (nunca o que o front calcula).
- [ ] Dado um cartão aprovado na hora, quando a resposta volta com `payment_status: "paid"`,
      então a tela de sucesso aparece direto, sem passar pela tela de QR/boleto.
- [ ] Dado Pix ou Boleto, o fluxo de exibição/polling continua idêntico ao da SPEC 079/080.

## Dados e contratos

- Nenhuma migration nova, nenhuma mudança em `pilar-token-pack-create` (já aceitava
  `CREDIT_CARD` desde o início — só nunca tinha sido exercitado pela UI).
- Nova rota `src/pages/comprar-tokens/index.tsx` dentro de `PrivateRoute` em `App.tsx`.
- `ComprarTokensDialog.tsx` e seu uso em `UsoPanel.tsx` são removidos (substituídos pela
  página).

## Plano de implementação

1. `App.tsx`: rota `/comprar-tokens` dentro de `PrivateRoute`.
2. `src/pages/comprar-tokens/index.tsx`: página com estado (tier selecionado, forma de
   pagamento, campos de cartão, estágio form/pagamento/sucesso), reaproveitando
   `PixPayment`/`BoletoPayment` e a validação de cartão do checkout público.
3. `UsoPanel.tsx`: botão "Comprar mais" navega em vez de abrir dialog.
4. Remover `ComprarTokensDialog.tsx` (sem mais uso).
5. Testar em staging via `vite preview`: Pix (fluxo já provado), Boleto, e cartão de
   crédito de teste do sandbox Asaas (documentação de cartões de teste do sandbox).

## Decisões e riscos

- Nenhum ADR novo; nenhuma decisão de pricing nova (só UX).
- Risco: cartão de teste do Asaas sandbox pode exigir número específico documentado pelo
  Asaas — checar a documentação de sandbox antes de testar (não inventar um número Luhn-
  válido qualquer, o sandbox valida contra números de teste conhecidos).
