# Auditoria: ativação do Asaas (assinatura do Pilar) — 2026-09-01

> Pedido do CEO após o teste do motor de tokens expor que "todo o sistema" de
> pagamento parecia desligado, não só a compra de pacote de token. Este doc
> levanta o estado real, verificado no código e nos dois projetos Supabase
> (staging `rizaklgstyfrwgmdsldf`, produção `vepnsonbnsimqcsfcagm`), e separa
> o que é do motor de tokens do que é a ativação de cobrança da plataforma.

## Achado principal

**Existem DUAS integrações Asaas distintas e independentes no repo.** Confundir
as duas foi o erro que motivou esta auditoria (inclusive um erro meu: a spec 074
do motor de tokens dizia que a Fase 3 reusaria `asaas-criar-cobranca`/
`asaas-webhook` — está errado, ver seção 3).

| | **A. Asaas do cliente** (por empresa) | **B. Asaas da plataforma** (Labrynth) |
|---|---|---|
| Quem paga quem | Cliente do Pilar cobra OS PRÓPRIOS clientes dele | Labrynth cobra o cliente do Pilar pela assinatura |
| Chave Asaas | Uma por empresa, o cliente cola a própria | Uma só, da conta Labrynth |
| Onde mora | `asaas_config` (cifrada via pgsodium/vault, migration `021_pgsodium_api_key.sql` + `20260850000000_asaas_api_key_cifra_real.sql`) | env vars `ASAAS_PLATFORM_*` (`_shared/asaas-platform.ts`) |
| Functions | `asaas-config`, `asaas-criar-cobranca`, `asaas-webhook` | `pilar-checkout-create`, `pilar-checkout-webhook`, `pilar-subscription-manage` |
| UI | `src/components/asaas/AsaasConfigForm.tsx`, montado em Admin → Integrações (`src/pages/admin/tabs/Integracoes.tsx`) — **existe e está no ar**, a nota antiga de memória "UI zero" está desatualizada | `src/pages/checkout/`, `src/pages/billing/` |
| Atualiza | `receitas`/`marcos_faturamento` do cliente | `pilar_subscriptions` (o próprio acesso do cliente ao Pilar) |
| Estado hoje | Código completo, tela existe, **nenhum cliente configurou ainda** (opt-in, não bloqueia nada nosso) | Código completo, **zero secret em qualquer ambiente**, nunca foi ligado |

**A dor que o CEO sentiu ("pagar o sistema mensalmente pra entrar") é 100% a
coluna B.** É essa que faz self-serve signup virar cliente pagante de verdade.
A coluna A é feature normal do produto, autônoma, sem urgência.

## Estado verificado de B (o que falta)

Secrets em **staging**: nenhum `ASAAS_PLATFORM_*` existe.
Secrets em **produção**: nenhum `ASAAS_PLATFORM_*` existe.

Ou seja: `pilar-checkout-create` e `pilar-subscription-manage` lançam
`"ASAAS_PLATFORM_API_KEY não configurada"` em qualquer chamada, nos dois
ambientes. Nunca houve um checkout real de assinatura processado por essa via
— bate com o estado "zero pagante" já registrado em memória.

**Boa notícia que não esperava**: a divergência de preço que o `PRICING.md`
(revisão 17/08) registrava como pendência bloqueante ("três números
diferentes, nenhum reconciliado") **já está resolvida**. Staging e produção
têm hoje o mesmo valor, batendo com a hipótese v3:

```
starter (Essencial)   R$ 490/mês  · R$ 4.900/ano
pro (Profissional)    R$ 690/mês  · R$ 6.900/ano
enterprise (Escala)   R$ 1.290/mês · R$ 12.900/ano
```

Isso tira um bloqueador do checklist do `PRICING.md` (item 1 do checklist de
17/08) — não precisa mais fazer aquela query de reconciliação, já reconciliou
em algum momento entre 17/08 e hoje.

## Checklist para ligar B em SANDBOX (recomendado como próximo passo)

Ordem importa: os três primeiros passos são ação sua (fora de código), o resto
eu faço.

1. **[Você] Criar/confirmar conta sandbox no Asaas** (sandbox.asaas.com) da
   Labrynth, se ainda não existir.
2. **[Você] Gerar a API key sandbox** no painel Asaas.
3. **[Você] Decidir o `ASAAS_PLATFORM_WEBHOOK_TOKEN`**: qualquer string
   secreta seguirá; eu posso gerar uma e você só cadastra no painel do Asaas.
4. **[Eu] Setar os 3 secrets em staging**: `ASAAS_PLATFORM_API_KEY`,
   `ASAAS_PLATFORM_ENV=sandbox`, `ASAAS_PLATFORM_WEBHOOK_TOKEN`.
5. **[Você, no painel Asaas sandbox] Cadastrar o webhook** apontando para
   `https://rizaklgstyfrwgmdsldf.supabase.co/functions/v1/pilar-checkout-webhook`
   (não é o `asaas-webhook` — esse é do sistema A, por empresa).
6. **[Eu] Teste ponta a ponta em staging**: rodar um checkout de teste
   (`pilar-checkout-create`) com cartão de teste do Asaas sandbox, confirmar
   que `PAYMENT_CONFIRMED` chega no webhook, ativa `pilar_subscriptions` e
   libera o acesso do signup pendente.
7. **[Eu] Conferir `pgsodium`/vault habilitado** em staging (`DEPLOY_CHECKLIST.md`
   linha 38) — só é necessário se algum fluxo tocar no sistema A durante o
   teste; para o B puro (checkout de assinatura) não é pré-requisito.

Critério de saída: um sinal de teste completo (signup → cobrança sandbox →
webhook → empresa ativa) rodando em staging, do jeito que um cliente real veria.

## Checklist adicional para virar PRODUÇÃO real (não fazer agora)

- Conta Asaas de produção da Labrynth (dados bancários, CNPJ, NFS-e configurada
  no próprio painel Asaas — isso é 100% fora do código, é cadastro na
  plataforma deles).
- Repetir os secrets em produção com a chave de produção (`ASAAS_PLATFORM_ENV=producao`).
- Cadastrar o webhook de produção (`https://vepnsonbnsimqcsfcagm.supabase.co/...`).
- Decisão de negócio: ter ao menos 1 cliente pronto pra ser cobrado de
  verdade. Sem isso, ligar produção só abre superfície de suporte/compliance
  (estorno real, disputa real, NFS-e real) sem nenhum retorno.

## Onde isso deixa o motor de tokens

A Fase 3 (compra de pacote de token) **deve reusar o sistema B** (Asaas de
plataforma — é a Labrynth cobrando o cliente, exatamente como a assinatura),
**não o sistema A**. A spec 074/PR anteriores descreveram errado (falavam em
`asaas-criar-cobranca`); corrigir quando a Fase 3 for retomada: o caminho certo
é uma function nova no estilo `pilar-checkout-create` (ou estender
`pilar-subscription-manage`), usando `_shared/asaas-platform.ts`, nunca
`asaas_config`/`asaas-criar-cobranca` (isso cobraria a conta Asaas do PRÓPRIO
cliente, não a da Labrynth — bug de cobrar a pessoa errada).

**Consequência prática:** ligar o sistema B em sandbox (checklist acima)
resolve DUAS pendências de uma vez — assinatura self-serve de verdade E a
pré-condição técnica da Fase 3 de tokens. Continuam sendo escopos de trabalho
separados (a Fase 3 ainda precisa da function nova + UI de compra), só a
credencial/infra de base é compartilhada.

## Recomendação

1. Ligar o sistema B em **sandbox** agora (checklist acima) — baixo risco, zero
   dinheiro real envolvido, destrava teste de ponta a ponta do self-serve.
2. **Não** ligar produção até ter um cliente concreto pronto pra pagar.
3. Tratar isso como iniciativa própria (esta auditoria + o teste de sandbox),
   não amarrada ao cronograma do motor de tokens — a Fase 3 de tokens só
   avança depois, e é trabalho pequeno assim que B estiver rodando.
