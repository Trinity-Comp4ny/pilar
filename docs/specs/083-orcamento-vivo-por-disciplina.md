# SPEC: Orçamento vivo por disciplina (destrava o guardião de margem)

**Data:** 2026-09-01
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos / agentes

<!-- Origem: achado ao consultar dado real de produção (MCP, projeto vepnsonbnsimqcsfcagm) logo
depois de entregar a spec 081 (guardião de margem). A spec 081 corrigiu a query pra comparar
despesas contra `projeto_orcamento_fases` (a mesma fonte que `rpc_dashboard_rentabilidade` usa
pra "horas_orcadas", desde 20260869000000) em vez de `escopos` (que ninguém populava). Mas
`projeto_orcamento_fases` também tem ZERO linhas em produção, em 68 projetos ativos — não existe
hoje nenhuma tela ativa onde alguém define esse orçamento. O agente de "Orçamento de Honorários"
de junho/2026 (spec agentic-strategy-2026-06) foi o único caminho que já escreveu nessa tabela, e
está abandonado (não faz parte de nenhum fluxo hoje).

Confirmado também: `projeto_disciplinas.horas_realizadas`/`custo_hora` (o lado REALIZADO, não
orçado, também usado por rpc_dashboard_rentabilidade desde a mesma migration) está igualmente
zerado (0 de 276 linhas) — mas essa tabela JÁ tem edição manual (`DisciplinaDetailDialog`), então
o gap ali é adoção, não infraestrutura ausente. O gap real desta spec é só o lado ORÇADO. -->

## Problema

Nenhum projeto em produção tem orçamento definido em `projeto_orcamento_fases`. Isso significa
que "horas_orcadas" no dashboard de Rentabilidade sempre mostra zero, e o guardião de margem
(spec 081, recém-entregue) nunca vai disparar pra ninguém — não porque a lógica esteja errada,
mas porque não existe hoje nenhuma tela onde um usuário define quanto um projeto deveria custar
por disciplina.

## Objetivo

Dentro da aba Escopo do projeto (criada na spec 081), o usuário define/edita, por disciplina já
cadastrada no projeto, as horas estimadas e o custo/hora — gravando direto em
`projeto_orcamento_fases` (upsert por `projeto_id` + `disciplina`, mesma unicidade que o trigger
`handle_escopo_aprovado` já respeita ao somar aditivos aprovados). Isso fecha o loop: orçamento
definido → guardião compara contra despesas → aditivo sugerido quando estoura.

**Fora de escopo:**

- **Orçamento assistido por IA / SINAPI / composição de custo.** Decisão de 26/08
  (`DECISOES.md`, gate D2) já fechou essa trilha. Esta spec é só o formulário manual mais simples
  que resolve o bloqueio de dado.
- **Reviver o agente de Orçamento de Honorários de junho.** Fora de escopo — se algum dia isso
  voltar à mesa, é decisão de produto própria, não consequência automática desta spec.
- **Ligar `projeto_disciplinas.horas_estimadas`/`custo_hora` a este formulário.** São conceitos
  parecidos (orçado vs realizado) mas tabelas e RPCs diferentes hoje (`rpc_dashboard_rentabilidade`
  já trata as duas como fontes separadas, deliberadamente). Não unificar aqui — risco de quebrar
  o cálculo de rentabilidade existente sem necessidade.
- **Aprovação/workflow pro orçamento.** Diferente do aditivo, o orçamento original é só editado
  diretamente por quem tem `projetos:editor` — não tem rascunho/aprovação (mesmo padrão de
  `PagamentosTab`/`DisciplinasTab`, campos editáveis direto).

## Requisitos

Funcionais:

1. A aba Escopo passa a mostrar, abaixo do card "Orçamento vivo do projeto", uma linha por
   disciplina do projeto (reaproveita a lista que `ProjetoDetailTabs` já busca, sem query nova)
   com dois campos editáveis: horas estimadas e custo/hora. O valor calculado (horas × custo)
   aparece ao lado, somando no card do orçamento vivo.
2. Salvar uma linha faz upsert em `projeto_orcamento_fases` (`empresa_id`, `projeto_id`,
   `disciplina`=nome da disciplina, `horas_estimadas`, `custo_hora`), `ON CONFLICT (projeto_id,
   disciplina)`.
3. Disciplina sem orçamento ainda mostra os campos vazios/zerados, não uma linha ausente — o
   usuário vê todas as disciplinas do projeto, define o que quiser, no seu tempo.
4. Sem `projetos:editor`, os campos aparecem só leitura (mesmo padrão de `canEdit` já usado nas
   outras abas do projeto).

Não-funcionais:

- **Segurança / RLS:** grava via client autenticado, RLS `escopos_write`-equivalente já existe
  pra `projeto_orcamento_fases`? Verificar antes de implementar — se não houver policy de escrita
  nesta tabela ainda (ela só foi escrita até hoje por SECURITY DEFINER), criar policy nova
  seguindo o padrão de `escopos_write` (`projetos:editor`).
- **Multi-tenant:** `empresa_id` resolvido via `get_user_empresa_id()`, nunca vindo do client.

## Critérios de aceite

- [ ] Dado um projeto com 3 disciplinas cadastradas e nenhum orçamento definido, quando o usuário
      abre a aba Escopo, então vê 3 linhas com campos vazios e o card de orçamento vivo em R$ 0.
- [ ] Dado que o usuário define horas + custo/hora numa disciplina e salva, então
      `projeto_orcamento_fases` ganha/atualiza a linha correspondente e o card de orçamento vivo
      soma o novo valor sem recarregar a página.
- [ ] Dado um orçamento definido e despesas do projeto acima dele sem aditivo em aberto, quando o
      cron do guardião de margem (spec 081) roda, então dispara de verdade (fecha o loop ponta a
      ponta, verificável em staging).
- [ ] Caso de borda: usuário sem `projetos:editor` vê os valores mas não consegue editar.
- [ ] Caso de borda: duas disciplinas com o mesmo nome no catálogo (raro, mas `disciplina` é
      texto livre) — o upsert por nome vira o mesmo orçamento pras duas; aceitar essa limitação
      nesta versão (mesma limitação que `handle_escopo_aprovado` já tem ao usar nome como chave).

## Dados e contratos

- Sem migration de coluna nova. Possível migration de RLS pra `projeto_orcamento_fases` se não
  houver policy de escrita por `projetos:editor` ainda (a verificar).
- Novo hook `useSalvarOrcamentoFase` (upsert), reaproveitando `useOrcamentoVivo` (spec 081) pro
  card de soma — sem duplicar leitura.

## Plano de implementação

1. Verificar RLS atual de `projeto_orcamento_fases`; criar policy de escrita se faltar.
2. Hook de upsert.
3. Seção "Orçamento por disciplina" dentro de `EscopoTab.tsx`, reaproveitando `dbDisciplinas` já
   passado pra `ProjetoDetailTabs`.
4. Teste (vitest do hook/seção; pgTAP se a policy for nova).
5. Verificação manual em staging: definir orçamento real num projeto de teste, confirmar que o
   guardião de margem dispara quando a despesa passa do valor.

## Decisões e riscos

- **Não unifica com `projeto_disciplinas.horas_estimadas`.** Risco aceito: dois lugares parecidos
  guardando "horas estimadas" (orçado em `projeto_orcamento_fases`, informativo em
  `projeto_disciplinas`) até que unificar vire necessidade real, não especulação.
- **Chave por nome da disciplina, não por ID.** Mesma limitação que já existe no trigger de
  aprovação de aditivo; não introduzida por esta spec.
