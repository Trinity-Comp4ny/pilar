# SPEC 130: Agente Produto e régua de ativação

**Data:** 2026-10-16
**Status:** Em implementação
**Autor:** Matheus Rezende + Claude
**Módulo:** ultra-admin (Time)

## Problema

Dois buracos do Time depois da [SPEC 129](./129-time-de-agentes-melhorias-pos-staging.md):

1. **Escritório novo sem acompanhamento.** O teste dura 3 dias e a Receita fala com ele só até virar
   pagante. Depois disso, o escritório em onboarding só recebe contato se sumir 7 dias. Quem
   cadastrou e parou no meio (sem projeto, sozinho, só numa área) passa despercebido justo na fase em
   que decide se o Pilar fica.
2. **Ninguém olha o produto como um todo.** A nota de saúde é por escritório. Não há quem diga que o
   Financeiro perdeu metade dos escritórios no mês, que Propostas quase não é usado ou que três bugs
   estão parados na triagem.

## Objetivo

Clientes acompanha o onboarding por marcos (projeto, equipe, segunda área) e o agente Produto entrega
toda segunda as tarefas da semana sobre uso por área e bugs parados, sem tela nova.

**Fora de escopo:** painel de adoção por área na ficha do Produto (precisa de protótipo no Claude
Design), eventos de fricção do PostHog (SPEC 125), agente Qualidade (precisa de token do Sentry).

## Requisitos

1. **Régua de ativação no Clientes.** Escritório pagante ou convidado em `onboarding` (menos de 14
   dias) recebe um rascunho de WhatsApp pelo primeiro marco que falta:
   - sem projeto ativo, a partir do dia 2: oferecer montar o primeiro projeto junto;
   - uma pessoa só, a partir do dia 5: oferecer ajuda para chamar a equipe;
   - uma área só em 28 dias, a partir do dia 9: mostrar projetos e Financeiro juntos.
     Um marco por vez, chave `ativacao:<empresa>:<marco>` (no máximo um contato por marco). Escritório
     sumido fica só com o contato de "sem acesso"; em teste fica com a Receita.
2. **Efeito da ativação.** `_ops_avaliar_contatos` conta o contato como "funcionou" quando o marco é
   atingido depois do envio: projeto novo, segunda pessoa ativa, lançamento no Financeiro.
3. **Agente Produto.** Roda toda segunda às 7h07 de Brasília (antes do Chefe). Lê `ops_produto()`:
   escritórios por área em 28 dias e nos 28 anteriores, e feedback de 30 dias. Grava tarefas internas
   (tipo alerta, N2, sem mensagem a cliente):
   - área que perdeu 2+ escritórios e 30% deles (uma por mês, prioridade alta);
   - área de produto usada por menos de 1 em 5 escritórios, com base de 5 ou mais (no máximo duas
     por mês, as menos usadas; Clientes e Pessoas ficam de fora por serem cadastro de apoio);
   - 3 ou mais bugs esperando triagem (uma por semana, prioridade alta).
     O modelo escreve só o briefing; o retrato do dia vai para `ops_metricas_diarias`.
4. **Ficha do Produto.** Mesmo esqueleto das outras: cabeçalho, briefing, "Tarefas da semana" (a
   fila que já existe) e histórico. Cada tarefa abre o destino gravado ("Ver atividade",
   "Ver feedback").

Não-funcionais:

- **Segurança:** `ops_produto` só para ultra admin ou service role (42501 para admin de empresa).
- **LGPD:** o modelo do Produto recebe só contagens; nada de título de feedback nem nome de
  escritório.
- **Custo:** um briefing por semana, dentro do teto de R$ 30 por mês do agente.

## Critérios de aceite

- [x] Marco por vez e na ordem; equipe só do dia 5, segunda área só do dia 9; em teste, fora do
      onboarding ou com tudo feito, nada (Deno).
- [x] Sumido recebe só "sem acesso", não ativação (Deno).
- [x] Produto: Financeiro de 6 para 3 vira "área em queda"; Obras de 5 para 4 não; Propostas 1 de 10
      vira "ignorada"; 3 bugs sem triagem viram tarefa (Deno).
- [x] Base de 4 escritórios não gera "ignorada"; Clientes e Pessoas nunca; no máximo duas; zero
      escrito "nenhum dos 10 escritórios" (Deno).
- [x] `ops_produto` lista as 7 áreas, conta o lançamento recente no Financeiro e o bug novo; admin de
      empresa recebe 42501 (pgTAP).
- [x] Ativação "equipe" com uma pessoa só não funcionou; "segundo módulo" com lançamento depois do
      envio funcionou (pgTAP).
- [x] Produto ligado com cron `7 10 * * 1`; a ficha mostra "toda segunda às 7h07" (pgTAP, vitest).

## Dados e contratos

- Migration `20261108000000_time_de_agentes_produto_ativacao.sql`: `ops_produto()` (jsonb),
  `_ops_avaliar_contatos()` com os marcos, cron `ops-produto`, agente `produto` ligado.
- `ops_acoes.rascunho.link` passa a vir do candidato (antes era sempre `/ultra-admin/feedback`).
- `ops-agente-run` aceita `agente_id: "produto"`.

## Plano de implementação

1. [x] Migration + pgTAP (`time_de_agentes.sql` 43 → 50).
2. [x] `regras.ts`: `marcoQueFalta`, ativação no Clientes, `candidatosProduto`, resumo e indicadores.
3. [x] `index.ts` e `prompt.ts`: área Produto, link por tarefa, empresa opcional no candidato.
4. [x] Front: Produto executável, `ProdutoPainel` com a fila, rótulo do link, cadência semanal.
5. [x] Playbooks: [produto.md](../operacao/agentes/produto.md) novo, [clientes.md](../operacao/agentes/clientes.md) com a régua.
6. [ ] Protótipo no Claude Design do painel de adoção por área (tabela por área com tendência) antes
       de qualquer tela nova do Produto.

## Decisões e riscos

- Fronteira e autonomia: [ADR 0060](../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md).
  Tarefa interna é N2 (o agente cria e avisa no resumo); mensagem a cliente segue N1.
- `audit_logs` mede escrita, não leitura: escritório que só consulta o Financeiro aparece como "não
  usou". Aceitável até o PostHog (SPEC 125) trazer visualização de tela.
- Com poucos escritórios no lançamento, uma área pode ir de 2 para 0 por acaso. O mínimo de 2
  escritórios perdidos e a chave mensal seguram o ruído; revisar os limites com 20 escritórios.
