# Catálogo de e-mails

Todo e-mail que o Pilar dispara, quem recebe e o que vai no corpo. ← [voltar ao índice](../README.md)

Fonte única do disparo: `supabase/functions/_shared/email/` ([ADR 0039](../architecture/adr/0039-email-transacional-modulo-unico-resend-e-log.md),
[SPEC 095](../specs/095-padronizacao-de-email-transacional.md)). Notificação por e-mail:
[SPEC 096](../specs/096-notificacao-por-email.md). Papéis: [ADR 0005](../architecture/adr/0005-permissoes-feature-flags.md).

Papéis ativos: **owner**, **admin**, **coordenador**, **colaborador** (+ **ultra_admin**, interno).
Grupos de destinatário usados no roteamento:

| Grupo              | Quem é                                                              | Onde vive                                                 |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Gestão             | owner, admin                                                        | `_notif_gestao()`                                         |
| Gestão operacional | owner, admin, coordenador                                           | `_notif_gestao_operacional()`                             |
| Vê financeiro      | todo papel exceto coordenador e colaborador                         | `_notif_ve_financeiro()`, espelha `can_view_financeiro()` |
| Responsáveis       | pessoas com conta vinculadas ao projeto, disciplina, tarefa ou obra | `_notif_resp_*()`                                         |

## 1. Conta e plataforma (Pilar para o usuário)

| E-mail                             | Dispara quando                        | Quem recebe                                     | Conteúdo sensível                  |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| Confirmar e-mail                   | cadastro novo ou troca de endereço    | quem se cadastrou                               | link de confirmação                |
| Seu convite chegou                 | admin convida alguém para a equipe    | o convidado                                     | link que cria a senha              |
| Redefinir senha                    | usuário pede "esqueci a senha"        | quem pediu                                      | link de 1 hora                     |
| Seu link de acesso                 | login por link, sem senha             | quem pediu                                      | link de 10 minutos, uso único      |
| Trial expirando (7, 3 e 1 dia)     | cron diária de trial                  | owner e admin da empresa                        | nome da empresa e prazo, sem valor |
| Pedido de exclusão de dados (LGPD) | usuário pede exclusão em /privacidade | admins da empresa e o encarregado da plataforma | e-mail e motivo de quem pediu      |

## 2. Escritório para o cliente final (via Pilar)

Remetente é `"<Empresa> via Pilar"`, a resposta vai para o e-mail da empresa, e o cabeçalho é
sempre o da Pilar. O disparo é sempre manual, por alguém da empresa.

| E-mail                     | Quem dispara                   | Quem recebe                             | Conteúdo sensível                  |
| -------------------------- | ------------------------------ | --------------------------------------- | ---------------------------------- |
| Lembrete de pagamento      | quem vê financeiro, na receita | e-mail do cliente cadastrado na receita | **valor, vencimento e chave Pix**  |
| Fatura em atraso           | idem                           | idem                                    | **valor e vencimento**             |
| Proposta enviada           | quem edita propostas           | e-mail informado no envio               | proposta em anexo, com preços      |
| Acesso ao portal criado    | admin                          | e-mail da conta do portal               | senha temporária                   |
| Senha do portal redefinida | admin                          | idem                                    | senha temporária                   |
| Mensagem manual            | qualquer usuário da empresa    | cliente da empresa                      | texto livre escrito pelo remetente |

## 3. Notificação da central (SPEC 096)

O e-mail não decide destinatário: transporta a notificação que já existe no sino, para o mesmo
destinatário e respeitando a preferência por categoria. Dois disparos: **imediato** (severidade
alta ou crítica, a cada 5 minutos, só se não foi lida no aplicativo) e **resumo semanal**
(segunda-feira, 08:00, um e-mail por pessoa com o que ficou sem leitura na semana).

| Notificação                              | Categoria           | Severidade | Quem recebe                                                                 | Valor em R$ no corpo        |
| ---------------------------------------- | ------------------- | ---------- | --------------------------------------------------------------------------- | --------------------------- |
| Pagamento vencido                        | financeiro          | crítica    | vê financeiro                                                               | sim                         |
| Recebimento vencido                      | financeiro          | alta       | vê financeiro                                                               | sim                         |
| A pagar ou a receber esta semana         | financeiro          | média      | vê financeiro                                                               | sim                         |
| Marco a faturar                          | financeiro          | alta       | vê financeiro                                                               | sim                         |
| Escopo estourado, sem aditivo            | financeiro          | alta       | vê financeiro                                                               | sim (gasto e orçado)        |
| Lucro não calculável (projeto sem custo) | financeiro          | média      | gestão                                                                      | não                         |
| Tokens de IA acabando                    | financeiro          | alta       | gestão                                                                      | não (saldo de tokens)       |
| Prazo de projeto estourado               | projeto             | alta       | gestão operacional e responsáveis do projeto                                | não                         |
| Prazo de projeto próximo                 | projeto             | média      | idem                                                                        | não                         |
| Disciplina atrasada                      | disciplina          | alta       | gestão operacional e responsáveis da disciplina                             | não                         |
| Prazo de disciplina próximo              | disciplina          | média      | idem                                                                        | não                         |
| Próxima etapa liberada                   | disciplina          | média      | responsáveis da próxima disciplina e gestão operacional, menos quem liberou | não                         |
| Disciplina atribuída a você              | disciplina          | média      | só a pessoa atribuída                                                       | não                         |
| Passo da obra atrasado                   | obra                | alta       | gestão operacional e responsáveis do passo                                  | não                         |
| Obra atrasada                            | obra                | alta       | gestão operacional e responsável da obra                                    | não                         |
| Obra sem diário há dias                  | obra                | média      | idem                                                                        | não                         |
| Tarefa atribuída a você                  | tarefa              | média      | só a pessoa atribuída, nunca quem atribuiu                                  | não                         |
| Menção em comentário                     | a do item comentado | média      | só quem foi mencionado                                                      | o que estiver no comentário |

## Regras que valem sempre

1. **Categoria financeiro nunca sai para coordenador nem colaborador.** O roteamento usa o mesmo
   critério que esconde o módulo Financeiro na tela. Vale para o sino e para o e-mail.
2. **Valor em R$ fica no corpo, nunca no assunto nem na pré-visualização.** O assunto usa o
   título da notificação ("Pagamento vencido: aluguel do escritório"), que não traz valor. Isso
   evita que o número apareça na tela de bloqueio do celular.
3. **Ninguém recebe e-mail de categoria que desligou** nas preferências de notificação.
4. **O e-mail sai do controle de acesso do aplicativo.** Uma vez entregue, fica na caixa da
   pessoa mesmo que ela seja desligada da empresa depois. Por isso o corpo carrega o dado do
   alerta, e não um extrato: para ver o resto é preciso abrir o Pilar e passar pela RLS.
5. **Toda linha enviada fica registrada** em `email_envios` (SPEC 095, fase 2), com tipo,
   destinatário e status de entrega. Bounce e reclamação entram em supressão automática.
6. **Nada de anexo com dado financeiro sem pedido explícito.** A única exceção é a proposta, que
   o usuário anexa deliberadamente ao enviar.
