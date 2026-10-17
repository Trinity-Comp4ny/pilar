# Playbook: Receita

**Missão:** fazer cada teste promissor virar pagante e nenhum pagamento escapar.

## Indicadores (RPC `ops_receita`)

| Indicador          | Regra                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| Cadastro           | empresa criada no período (fora a empresa da Pilar, a que tem ultra admin) |
| Ativado            | cadastro com pelo menos um projeto real (`projetos.exemplo = false`)       |
| Novo pagante       | `trial_converted_active` no `admin_audit_logs` dentro do período           |
| Pagante            | assinatura `active` com assinatura no Asaas                                |
| MRR                | preço do plano no ciclo; anual dividido por 12                             |
| Teste vencendo     | `trialing` com `trial_ends_at` nas próximas 48 h                           |
| Em atraso          | assinatura `overdue`                                                       |
| Checkout sem pagar | `pilar_pending_signups` do período sem `paid_at`                           |
| Origem             | `utm_source` e `utm_campaign` gravados pelo `/cadastro` no dono da empresa |

Toda variação compara com o período anterior de mesmo tamanho.

## Gatilhos e ações

| Situação                                    | Prioridade   | Ação                                                       | Autonomia |
| ------------------------------------------- | ------------ | ---------------------------------------------------------- | --------- |
| Teste vence em até 48 h                     | hoje         | WhatsApp para o dono; texto muda se ainda não há projeto   | N1        |
| Pagamento em atraso                         | hoje         | WhatsApp oferecendo o link de novo ou outra forma de pagar | N1        |
| Cadastro novo (fase 1)                      | em 2 h úteis | boas-vindas pessoal                                        | N1        |
| Checkout iniciado sem pagar há 2 h (fase 1) | hoje         | mensagem perguntando se travou                             | N1        |

Textos de partida em `src/pages/ultra-admin/time/lib.ts` (`mensagemTesteVencendo`, `mensagemAtraso`).
Voz: `brand/voice-tone.md`. Sem travessão, sem "Oops", uma pergunta por mensagem.

## Nunca

- Enviar mensagem sem aprovação na fase 1.
- Prometer desconto ou condição de preço (isso é do agente de pricing e do fundador).
- Mandar valor financeiro do cliente para o modelo.
