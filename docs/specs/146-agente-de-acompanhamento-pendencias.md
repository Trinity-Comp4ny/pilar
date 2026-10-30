# SPEC: Agente de acompanhamento: a aba Pendências mostra tudo que segue em aberto

**Data:** 2026-10-30
**Status:** Em implementação (backend pronto; tela aguarda protótipo, BEZ-511)
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** agentes / financeiro / projetos / obras
**ClickUp:** BEZ-508 (pai), BEZ-509, BEZ-510, BEZ-511

## Problema

A aba Pendências de /agentes (SPEC 084) mostra só aditivos que o guardião de margem prepara. Em produção ela está
vazia, e o motivo não é bug de infraestrutura: o cron roda todo dia (14 execuções seguidas com sucesso) e acha 0
porque nenhum dos 21 projetos em andamento tem orçamento por disciplina, a única entrada do guardião. A tela ainda diz
"viu 0 projeto(s)", o que parece "tudo certo".

Enquanto isso, o que está em aberto de verdade não aparece em lugar nenhum com dono e idade. Em produção hoje: 22
recebimentos vencidos (o mais antigo há 263 dias), 14 pagamentos vencidos, 28 projetos atrasados, 12 disciplinas
atrasadas, 65 projetos com contrato e sem orçamento. O sino avisa por evento e repete; não responde "o que continua em
aberto e há quanto tempo".

Achado extra da investigação: os quatro laços financeiros de `gerar_notificacoes_ambient()` liam receitas e despesas
sem `deleted_at IS NULL`. Dos 139 avisos de recebimento atrasado dos últimos 30 dias, 129 apontavam para receita já
excluída. Corrigido na mesma migration.

## Objetivo

A aba Pendências passa a listar tudo que o agente de acompanhamento encontra em aberto (parcela e conta vencidas ou
a vencer, prazo de projeto e disciplina, orçamento incorreto ou ausente, tarefa da obra vencendo, o que falta
planejar, lead com previsão vencida), cada item com a data, o valor, o projeto, há quantos dias está aberto e a ação
que resolve. O item fecha sozinho quando a condição some.

**Fora de escopo:**

- **Texto escrito por IA.** Os fatos e os títulos vêm de regra em SQL ([ADR 0065](../architecture/adr/0065-pendencia-vem-de-regra-a-ia-escolhe-a-consulta.md)).
  A IA entra no chat (SPEC 147), não na detecção.
- **Trocar o sino.** O sino segue sendo aviso de evento. Integrar (avisar só quando um item novo entra na fila) fica
  para a fase 3.
- **Regras configuráveis por empresa** (limiar de dias, tipos ligados e desligados). Fase seguinte, depois de ver o
  volume real.
- **Aprovar aditivo** continua como está (SPEC 084); o aditivo vira mais um tipo de card na mesma aba.

## Requisitos

Funcionais:

1. Uma varredura grava uma pendência por (empresa, tipo, registro). Rodar de novo não duplica e mantém a idade.
2. Tipos da v1: `recebimento_atrasado`, `a_receber_proximo`, `pagamento_atrasado`, `a_pagar_proximo`,
   `marco_a_faturar`, `projeto_atrasado`, `projeto_prazo_proximo`, `disciplina_atrasada`,
   `disciplina_prazo_proximo`, `orcamento_ausente`, `orcamento_acima_do_contrato`, `orcamento_estourado`,
   `tarefa_obra_atrasada`, `tarefa_obra_vencendo`, `obra_atrasada`, `projeto_sem_prazo`, `obra_sem_cronograma`,
   `lead_previsao_vencida`.
3. Registro excluído (`deleted_at`), projeto pausado ou concluído, disciplina concluída ou pausada, fatura de cartão
   e tarefa concluída não geram pendência.
4. Quando a regra deixa de achar o item (parcela recebida, prazo ajustado), a pendência fecha com
   `resolvida_motivo = 'condicao_sumiu'`. Se a condição voltar, reabre como ocorrência nova, com idade zerada.
5. Adiar (1 a 30 dias) e dispensar. Adiada volta a abrir sozinha na data. Dispensada fica assim enquanto a condição
   existir.
6. Abrir a aba atualiza a fila da empresa de quem abriu (pula se rodou há menos de 5 minutos). Um cron diário às
   06:25 UTC varre todas as empresas e registra heartbeat.
7. A aba nunca diz "viu 0" sem explicar: com projeto em andamento sem orçamento, diz quantos são e leva ao projeto
   (BEZ-509, entregue nesta fase).
8. Itens com `acao_sugerida` (`marcar_recebido`, `marcar_pago`, `preparar_aditivo`) levam ao chat com a operação
   pronta para confirmar (SPEC 147, fase B).

Não funcionais:

- **Segurança / RLS:** leitura por área com os mesmos gates das tabelas de origem: financeiro e orçamento exigem
  `can_view_financeiro()`; obra, `obras:viewer`; comercial, `leads:viewer`; prazos e planejamento, `projetos:viewer`.
  O usuário só altera `status` e `adiada_ate` (GRANT por coluna). Detector e varredura só o `service_role` executa.
  Nada de valor de lead (`valor_estimado` é fechado para leitura direta).
- **Multi-tenant:** `empresa_id` em toda linha; a varredura do usuário deriva a empresa do perfil, sem argumento.
- **Performance:** detecção em uma consulta por empresa, índice por (empresa, status, severidade, idade).

## Critérios de aceite

Cobertos por `supabase/tests/agente_pendencias.sql` (21 asserções):

- [x] Dado receita vencida, despesa a vencer, projeto atrasado e com prazo próximo, tarefa de obra vencida e orçamento
      maior que o contrato, quando o detector roda, então cada um vira o tipo certo, com dias de atraso e número da
      parcela nos fatos.
- [x] Receita excluída não vira pendência.
- [x] Varrer duas vezes não duplica e mantém `primeira_deteccao`.
- [x] Receber a parcela fecha a pendência sozinho; voltar a pendente reabre com idade zerada.
- [x] Admin da empresa A vê todas as áreas; coordenador não vê financeiro nem orçamento; admin da empresa B não vê
      nada da A.
- [x] Usuário logado não chama o detector direto e não altera `titulo`.
- [x] Adiar de 1 a 30 dias; adiada e dispensada se mantêm entre varreduras; adiada vencida volta a abrir.
- [x] `agente_pendencias_atualizar()` varre só a empresa de quem chamou.
- [ ] Tela: com a fila cheia, a aba agrupa por área, ordena por urgência e idade e mostra ação por item (BEZ-511).

## Dados e contratos

- Migration `20261125000000_agente_pendencias_acompanhamento.sql`: tabela `agente_pendencias`, função
  `agente_pendencia_visivel(area)`, `agente_pendencias_detectar(empresa)`, `agente_pendencias_varrer(empresa)`,
  `agente_pendencias_atualizar()`, `agente_pendencia_adiar(id, dias)`, `agente_pendencia_dispensar(id)`,
  `agente_pendencias_varrer_cron()` e o job `agente-pendencias-daily`; corrige `gerar_notificacoes_ambient()` e
  arquiva os avisos que apontavam para receita ou despesa excluída.
- `dados` (jsonb) carrega os fatos de cada tipo (valor, vencimento, dias, parcela, projeto, cliente). O front formata.
- Heartbeat `acompanhamento_cron` em `agent_cron_heartbeats`.

## Plano de implementação

1. **Fase 1 (esta PR):** banco, detector, varredura, cron, RLS, teste pgTAP, aviso do guardião (BEZ-509), correção do
   sino.
2. **Fase 2 (BEZ-511):** protótipo no Claude Design (desktop e mobile; estados vazio, carregando, erro, cheio),
   aprovação, depois tela: agrupar por área, filtro, ordenar por urgência e idade, adiar e dispensar, link para o
   registro, botão "Resolver com o agente". Selo do menu lateral passa a contar urgentes.
3. **Fase 3:** sino avisa só quando um item novo entra na fila; resumo diário das urgentes por e-mail.

## Decisões e riscos

- **Volume.** Em produção a v1 gera ~150 itens (65 são `orcamento_ausente`, severidade baixa). A tela precisa agrupar
  e começar pelas urgentes; a aba não pode virar lista de 150 linhas.
- **`orcamento_ausente` é setup, não alerta.** Fica em severidade baixa e agrupado; some quando o orçamento é feito.
- **Guardião de margem** vigia só `status = 'Em andamento'` e exige orçamento por disciplina. Aqui `orcamento_ausente`
  cobre também Planejamento, Execução e Revisão. Decidir depois se o guardião acompanha.
- **Disciplina e prazo próximo geram muitos itens de baixa severidade.** Se o volume incomodar, sobe o limiar ou
  agrupa por projeto na tela.
- **Protótipo:** pendente (BEZ-511). Sem protótipo aprovado não há código de tela.
