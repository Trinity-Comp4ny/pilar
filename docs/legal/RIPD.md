# Relatório de Impacto à Proteção de Dados (RIPD) do Pilar

**Versão:** 1, 2026-10-13
**Base:** LGPD, art. 5º XVII e art. 38
**Registro das operações:** [ROPA](../ROPA.md) · **Operadores:** [SUBPROCESSADORES.md](./SUBPROCESSADORES.md)

> Documento vivo. Revisar a cada operação nova no ROPA, fornecedor novo ou mudança de
> base legal. Não descreve falha de segurança em aberto (repositório público); o
> acompanhamento de vulnerabilidade é privado.

## 1. Descrição do tratamento

O Pilar é um SaaS de gestão para escritórios de projeto (engenharia e arquitetura). A
empresa cliente é a **controladora** dos dados que cadastra (clientes dela, equipe, obra,
financeiro); o Pilar é **operador** desses dados e **controlador** dos dados de conta dos
próprios usuários (login, preferências, consentimentos, cobrança da assinatura).

Categorias tratadas, finalidades e bases legais estão por operação no ROPA (14 itens).
Dado sensível (art. 5º II) não é objeto do produto; pode aparecer de forma incidental em
texto livre (observação, conversa com a IA).

## 2. Necessidade e proporcionalidade

- **Minimização na telemetria:** Sentry e PostHog recebem o id do usuário, nunca e-mail
  ou telefone; propriedades de evento são contagem, categoria ou booleano; a gravação de
  sessão com erro mascara texto, campos e mídia (ROPA itens 11 e 14).
- **Analytics só com consentimento**, fail-closed (ADR 0022 e 0032).
- **IA:** o provedor recebe só o texto necessário à tarefa; no Gemini, uso no tier pago,
  sem treino com o conteúdo (SUBPROCESSADORES.md). Conteúdo de prompt não vai para o
  Sentry fora de desenvolvimento (ADR 0053).
- **APIs públicas** recebem só CEP, CNPJ, endereço ou coordenada, sem identificação de pessoa.

## 3. Riscos e controles

| Risco                                                 | Controles no produto                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acesso de uma empresa ao dado de outra (multi-tenant) | RLS em toda tabela, testes pgTAP de isolamento no CI, matriz de acesso por papel (MATRIZ_DE_ACESSO.md)                                                       |
| Acesso indevido dentro da empresa                     | Papéis e módulos por usuário (SPEC 058), financeiro delegado explícito, auditoria de ações                                                                   |
| Conta comprometida                                    | MFA para admin, rate limit no login, Turnstile no cadastro, sessão do portal com token só em hash                                                            |
| Vazamento por terceiros                               | Lista de operadores pública, minimização (seção 2), segredos no Vault, nunca no bundle                                                                       |
| Dado retido além do necessário                        | Retenção pós-trial com aviso nos dias 60 e 85 e exclusão só 5 dias depois do aviso final; anonimização do que tem retenção fiscal (ADR 0043)                 |
| Titular sem resposta no prazo                         | Exportação automática dos dados da conta com link de 7 dias (SPEC 115); exclusão com aviso ao encarregado; prazo do art. 19 monitorado pelo status do pedido |
| Indisponibilidade ou perda                            | Backup noturno cifrado com teste de restauração, status page externa                                                                                         |
| Erro de cobrança afetando acesso                      | Reconciliação diária com o Asaas, avisando divergência (SPEC 114)                                                                                            |

## 4. Riscos residuais e plano

| Risco residual                                                                  | Situação                                             | Ação                                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Transferência internacional (Vercel, Sentry, PostHog, Resend, provedores de IA) | Sem cláusula específica assinada com cada fornecedor | Aceitar o DPA de cada operador (COMPLIANCE.md, "Fornecedores críticos") |
| Controlador sem CNPJ próprio                                                    | Risco aceito pelo CEO (docs/legal/README.md)         | Atualizar políticas e este RIPD quando o CNPJ sair                      |
| Termos e política sem revisão jurídica                                          | Pendente                                             | Revisão por advogado                                                    |
| Encarregado (DPO)                                                               | Contato público `privacidade@pilarsoft.com.br`       | Nomear formalmente quem responde e manter a caixa monitorada            |

## 5. Conclusão

Os tratamentos são compatíveis com as finalidades declaradas e os riscos principais
têm controle técnico verificado em CI. Os riscos residuais são contratuais e de
governança (seção 4) e não exigem mudança de produto.
