# SPEC: Pendência com trabalho pronto: cobrança por e-mail, orçamento guiado e plano de prazo

**Data:** 2026-11-02
**Status:** Em implementação (cobrança, orçamento guiado e plano de prazo prontos no código; falta verificar o envio no staging)
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** agentes / financeiro
**ClickUp:** BEZ-518 (pai), BEZ-519 (cobrança), BEZ-520 (prazo), BEZ-521 (orçamento)
**Protótipo:** v2 aprovada em 02/11/2026 (Claude Design, artifact "Pilar: Agentes v2, trabalho pronto para aprovar")

## Problema

A aba Pendências da SPEC 146 mostra o que está em aberto, mas ainda parece os avisos da tela de início: "a parcela vence", "o prazo está próximo". O dono pediu um agente que faça o trabalho até o ponto de aprovar: achar o dado, entender o contexto e deixar o próximo passo pronto. A pendência mais direta é a parcela atrasada: hoje o usuário precisa lembrar, escrever o e-mail e mandar. Em produção, 23 parcelas estão vencidas (a mais antiga há 263 dias) e 15 delas têm cliente com e-mail válido.

## Objetivo

Para cada parcela a receber, o agente prepara o e-mail da etapa devida (escada de cobrança) e o coloca na aba Pendências como "pronto para aprovar". O usuário revisa, edita a abertura e aprova; o e-mail sai pelo Pilar. Nada é enviado sem o clique.

Duas outras pendências ganham painel de revisão, com as decisões do dono de 02/11/2026: **orçamento por disciplina guiado** (o agente lista as disciplinas, o usuário informa horas e custo por hora, e margem e custo aparecem na hora) e **plano de prazo em risco sem previsão de data** (avisar a equipe, comunicar o cliente, criar aditivo de prazo).

**Fora de escopo:**

- **Envio automático.** Tudo passa pela aprovação. Oferecer o envio automático do lembrete de 3 dias antes depois de 5 aprovações sem edição fica para a fase seguinte (BEZ-518).
- **WhatsApp.** Só e-mail.
- **Texto escrito por modelo na v1.** A abertura é montada por regra, com fatos do banco (inclusive o atraso médio histórico do cliente). Reescrever com IA vem depois, sempre com os fatos fixos (ADR 0065).
- **Cobrança de contas a pagar.** É cobrança de cliente (receitas); conta a pagar continua como aviso.
- **Boleto e PIX do Asaas no e-mail.** O e-mail leva a chave PIX do escritório quando cadastrada. Link do Asaas fica para depois.

## Requisitos

1. **Escada por parcela:** etapa 1 lembrete (3 dias antes), 2 aviso (1 dia depois), 3 direta (7 dias depois), 4 firme (15 dias depois). Aos 30 dias com cobrança já enviada, sem e-mail: pendência "ligue ou negocie".
2. **Só a etapa devida hoje.** Parcela com 40 dias de atraso e nenhum contato recebe a etapa 4, nunca quatro e-mails seguidos. Rascunho de etapa que ficou para trás é cancelado.
3. **Intervalo mínimo de 5 dias** entre cobranças enviadas (ou marcadas como feitas por fora) da mesma parcela.
4. **Texto por etapa**, com cliente, parcela, projeto, vencimento e dias de atraso. A etapa 2 e a 3 citam o atraso médio das últimas parcelas pagas pelo cliente, quando há pelo menos 2.
5. **Pré-requisitos viram pendência:** cliente sem e-mail válido (uma pendência por cliente, com a quantidade de parcelas) e escritório sem e-mail cadastrado (as respostas voltam para ele).
6. **Painel de revisão:** escada com a etapa atual, "Por que apareceu?", destinatário, assunto, abertura editável e os dados fixos da parcela. Saídas: Aprovar e enviar, Editar, Recusar, Já cobrei por fora.
7. **Parcela paga cancela o rascunho** e fecha a pendência sozinha; parcela cobrada mostra "Cobrada em dd/mm (etapa n de 4)".
8. **Quem envia:** quem vê dinheiro e edita o financeiro. Quem só visualiza lê o rascunho sem botões.
9. **Registro de cada cobrança** (rascunho, enviada, recusada, por fora, cancelada) na tabela `cobrancas`.
10. **Orçamento guiado** (`orcamento_ausente`): painel com as disciplinas do projeto, horas e custo por hora (campo de dinheiro padrão), contrato, custo orçado e margem calculados na hora, aviso quando o custo passa do contrato. Salvar grava `projeto_orcamento_fases` (mesma unicidade da aba Escopo) e a pendência fecha na hora. Só disciplinas com horas e custo entram. Os números são sempre do usuário.
11. **Plano de prazo** (`projeto_prazo_proximo`): painel com as disciplinas ainda abertas e três ações opcionais, cada uma aplicada separadamente. (a) avisar os responsáveis (`projeto_prazo_avisar`, vai para a gestão se ninguém tem conta); (b) comunicar o cliente por e-mail com texto editável que não promete data (função `send-manual-client-email`, exige cliente com e-mail); (c) criar rascunho de aditivo de prazo sem valor, com os dias informados (`projeto_aditivo_prazo_criar`; aprovar na aba Escopo move a entrega). Se uma ação falha, as que deram certo ficam travadas e a nova tentativa reenvia só a que falhou. Aplicar algo adia a pendência por 3 dias.
12. **Atualização forçada da fila** depois de ações que mudam o dado de origem (`agente_pendencias_atualizar(p_forcar)`).

Não funcionais:

- **Segurança:** envio só pela função `cobranca-enviar` (valida papel, empresa, estado do rascunho e da parcela); abertura editada com no máximo 1.500 caracteres, escapada no HTML; teto de 30 envios por usuário por hora; idempotência por cobrança. Leitura de `cobrancas` exige `can_view_financeiro()` e `financeiro:viewer`.
- **Anti-repetição do erro:** um rascunho por (parcela, etapa), garantido por chave única; recusar uma etapa não a traz de volta.

## Critérios de aceite

Cobertos por `supabase/tests/cobrancas.sql` (25 asserções), `cobranca-enviar/entrada.test.ts`, o teste do template e `PendenciasTab.test.tsx`:

- [x] Parcela 7 dias atrasada recebe a etapa 3; 20 dias, a etapa 4; 2 dias antes, a etapa 1; rascunho velho é substituído.
- [x] Cliente sem e-mail e escritório sem e-mail não geram rascunho; geram a pendência de cadastro.
- [x] Parcela já cobrada na etapa 4 não recebe outro rascunho; aos 30 dias vira "ligue ou negocie".
- [x] A abertura usa o atraso médio histórico na etapa 3 e não na etapa 4.
- [x] Parcela com cobrança pronta não aparece também como atrasada.
- [x] Recusar fecha a pendência e não recria a etapa; por fora registra quando e em que etapa.
- [x] Parcela paga cancela o rascunho. Coordenador não lê nem decide; admin de outra empresa não vê.
- [x] Texto editado é escapado no e-mail e o assunto da etapa é usado.
- [x] Painel: aprovar sem editar não reenvia texto; aprovar editado leva o texto; sem permissão os botões ficam desabilitados.
- [x] Orçamento: cálculo de custo e margem, só linhas válidas vão para o banco, aviso de custo acima do contrato, projeto sem disciplinas orienta (`plano.test.ts`, `PendenciasTab.test.tsx`); salvar no app local grava 3 disciplinas e fecha a pendência na hora.
- [x] Prazo: só disciplinas abertas, comunicado sem prometer data, dias do aditivo obrigatórios, cliente sem e-mail bloqueia o comunicado, falha parcial trava o que já foi aplicado (`supabase/tests/prazo_em_risco.sql`, 12 asserções); aplicar no app local criou a notificação e o aditivo de 11 dias sem valor e adiou a pendência.
- [ ] Verificação ao vivo no staging: aprovar uma cobrança e receber o e-mail (precisa de escritório com e-mail e cliente com e-mail de teste).

## Dados e contratos

- Migration `20261126000000_cobranca_escada_e_rascunhos.sql`: tabela `cobrancas`, `cobranca_montar_abertura`, `cobranca_gerar_rascunhos`, `agente_pendencias_detectar_cobranca`, `cobranca_decidir`; a varredura da SPEC 146 passa a gerar rascunhos, juntar as regras de cobrança, suprimir o aviso duplicado e anotar a última cobrança.
- Edge function `cobranca-enviar` (entrada: `cobranca_id`, `abertura?`); template `templateCobrancaDireta` ganha `abertura` e `assunto`.
- Pendências novas: `cobranca_pronta` (ação `enviar_cobranca`), `cobranca_sem_email`, `cobranca_sem_email_empresa`, `cobranca_ligar`.

## Achados (dados reais de produção, 02/11/2026)

- **Cobrança:** viável hoje. 23 parcelas vencidas, 15 com e-mail de cliente. Só 5 de 10 empresas têm e-mail cadastrado e **nenhuma tem chave PIX**: o e-mail sai sem instrução de pagamento até o escritório cadastrar. A pendência "cadastre o e-mail" cobre o primeiro caso; o segundo precisa de aviso próprio (BEZ-519).
- **Prazo em risco com previsão de data:** inviável hoje. Nenhuma disciplina tem horas realizadas e só 2 tarefas têm horas reais; sem isso não há ritmo nem previsão, e o número "carga 142%" seria inventado. Versão entregue (decisão do dono, 02/11/2026): projeto com entrega em até 14 dias e disciplinas abertas, com avisos, comunicado e aditivo de prazo, sem data prevista. A previsão entra quando o lançamento de horas existir.
- **Orçamento rascunho a partir da proposta:** inviável hoje. Dos 65 projetos sem orçamento, 0 têm proposta ou disciplina com horas. Decisão do dono (02/11/2026): preenchimento guiado. Sem sugestão de custo por hora: o custo médio da folha derivaria de salário, que só admin vê, então o campo fica com o usuário.

## Plano de implementação

1. **Fase 1 (esta PR):** banco, função de envio, painel de revisão, lista nova da aba Pendências, testes.
2. **Fase 2:** aviso de PIX não cadastrado; reescrita da abertura por IA com fatos fixos; envio automático do lembrete de 3 dias antes depois de 5 aprovações sem edição.
3. **Fase 3 (entregue na mesma PR):** orçamento guiado e plano de prazo em risco sem previsão numérica. Previsão de data e carga do responsável entram quando houver lançamento de horas.

## Decisões e riscos

- **Texto por regra na v1:** previsível, testável e sem custo de IA. O ganho de personalização por IA é menor que o risco de uma cobrança com tom errado numa relação com cliente.
- **Intervalo de 5 dias** vale para "por fora" também (a v2 do protótipo dizia 7). Ajustar se o uso mostrar que é pouco.
- **Idade da parcela e volume:** a parcela mais antiga tem 263 dias; ao ligar o envio, o primeiro rascunho dela já será a etapa 4. O usuário pode usar "Já cobrei por fora" ou "Recusar" sem mandar nada.
- **Resposta do cliente** volta para o e-mail do escritório; o Pilar não lê a caixa. Registrar resposta é trabalho futuro.
