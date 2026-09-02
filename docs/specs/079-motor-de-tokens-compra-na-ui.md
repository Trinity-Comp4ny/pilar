# SPEC: Motor de tokens, Fase 4: fluxo de compra na UI

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Último bullet pendente da Fase 4 de [MOTOR_DE_TOKENS.md](../strategy/MOTOR_DE_TOKENS.md)
> ("fluxo de compra na UI") — saldo, extrato e alerta já entregues na SPEC 076. Consome o
> backend da [SPEC 077](077-motor-de-tokens-compra-de-pacote-asaas.md) (`pilar-token-pack-create`
> + crédito via `pilar-checkout-webhook`), já verificado ponta a ponta em staging.

## Problema

A compra de pacote de tokens existe no backend mas só é acionável via curl. O cliente que
zera o saldo (Fase 2, gate ativo) não tem como resolver sozinho dentro do produto.

## Objetivo

Admin da empresa compra pacote de 500 mil tokens direto da aba **Uso** das Configurações,
paga via Pix ou boleto, e vê o saldo atualizar assim que o webhook confirma — sem sair do
app nem falar com o suporte.

**Fora de escopo:**
- Cartão de crédito no fluxo de compra (exige coletar dados do titular; fica pra uma
  iteração futura se o design partner pedir — Pix/boleto cobre a fricção mínima).
- Escolher a quantidade de pacotes acima do necessário pra resolver o bloqueio — o limite
  de 1-20 pacotes por compra já existe no backend (SPEC 077); a UI só expõe esse range.
- Editar/cancelar uma compra em andamento.
- Refletir a receita de pacote avulso no painel de margem do ultra-admin (gap conhecido,
  registrado em `project_motor_de_tokens_fase3_compra_pacote_2026-09-01`).

## Requisitos

Funcionais:

1. Na aba Uso (`UsoPanel.tsx`), ao lado do saldo de "Tokens comprados", existe um botão
   "Comprar mais tokens".
2. O botão abre um diálogo (`FormDialog`, `size="sm"`) com: quantidade de pacotes (1-20,
   default 1, com o total em tokens e em R$ recalculado ao digitar) e forma de pagamento
   (Pix ou boleto). Submeter chama `pilar-token-pack-create`.
3. Ao criar a cobrança com sucesso, o primeiro diálogo fecha e um segundo diálogo abre
   mostrando o pagamento: QR Pix (reusa `PixPayment`, mesmo componente do checkout
   público) ou linha digitável do boleto (reusa `BoletoPayment`), com polling do status
   da compra (`pilar_token_pack_purchases.status`, direto via client autenticado — RLS já
   permite ler a própria compra, sem endpoint novo).
4. Assim que `status` vira `paid`, o diálogo mostra confirmação, invalida a query de saldo
   (`["uso-empresa", empresaId]`) pra os cards de tokens atualizarem sem reload, e um toast
   confirma o crédito.
5. Erro do backend (empresa isenta sem `asaas_customer_id`, rate limit, falha do Asaas)
   aparece como mensagem inline no primeiro diálogo, sem fechar — mesmo padrão de erro dos
   outros formulários (`CheckoutForm`).

Não-funcionais:

- **Reuso:** `PixPayment`/`BoletoPayment` (`src/pages/checkout/components/`) são
  reaproveitados sem alteração — mesmo shape de props que o checkout público já usa.
- **Sem endpoint novo:** status da compra lido via `supabase.from("pilar_token_pack_purchases")`
  (RLS da SPEC 077 já cobre), com `refetchInterval` como `useCheckoutStatus` faz hoje.

## Critérios de aceite

- [ ] Dado o admin da empresa na aba Uso, quando clica "Comprar mais tokens", então vê o
      formulário com quantidade e forma de pagamento.
- [ ] Dado o formulário preenchido (1 pacote, Pix) e submetido, então aparece o QR Pix
      real do sandbox.
- [ ] Dado o pagamento confirmado no Asaas, quando o polling detecta `status='paid'`,
      então a UI mostra sucesso e o card "Tokens comprados" reflete o novo saldo sem
      reload da página.
- [ ] Dado um usuário sem role admin/ultra_admin, o botão de compra não aparece (mesmo
      guard de role que a function já aplica no backend).
- [ ] Caso de borda: empresa isenta (sem assinatura) → erro inline "sua empresa ainda não
      tem cobrança ativa...", sem quebrar o diálogo.

## Dados e contratos

- Nenhuma migration nova.
- Novo hook `useTokenPackCreate` (mutation, `supabase.functions.invoke("pilar-token-pack-create")`).
- Novo hook `useTokenPackStatus(purchaseId)` (query direta na tabela, com `refetchInterval`).
- Novo componente `ComprarTokensDialog` em `src/components/settings/`.

## Plano de implementação

1. `useTokenPackCreate.ts` — mutation espelhando `useCheckoutCreate.ts`.
2. `useTokenPackStatus.ts` — query espelhando `useCheckoutStatus.ts`, mas via `supabase.from(...)` direto.
3. `ComprarTokensDialog.tsx` — dois estágios (form → pagamento), reusando `PixPayment`/`BoletoPayment`.
4. `UsoPanel.tsx` — botão "Comprar mais tokens", só pra `profile.role` admin/ultra_admin.
5. Testar manualmente em staging (mesma empresa de teste da verificação da Fase 3):
   abrir o diálogo, comprar 1 pacote via Pix, confirmar no sandbox, ver o saldo atualizar
   na UI sem reload.

## Decisões e riscos

- Nenhum ADR novo.
- Risco: usuário fecha o diálogo antes do webhook confirmar. Aceito — o saldo aparece
  correto na próxima abertura da aba Uso (a query não depende do diálogo estar aberto).
