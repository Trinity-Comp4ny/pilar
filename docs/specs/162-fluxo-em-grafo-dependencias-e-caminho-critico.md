# SPEC: Fluxo em grafo: dependências, datas projetadas e caminho crítico

**Data:** 2026-11-11
**Status:** Em implementação (fase 1)
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos
**Estende:** [051 — Duração por etapa, prazo em cascata](051-duracao-por-etapa-fluxo-prazo-cascata.md) e [071 — Fluxo sem a camada "etapa"](071-fluxo-disciplinas-plano-sem-etapa.md)
**Supera:** o item "DAG genérico com dependências arbitrárias" do fora de escopo da 071 e o item "recalcular datas futuras quando uma etapa atrasa" do fora de escopo da 051 (ver DECISOES.md, 2026-11-11)

## Problema

O sócio de um escritório de projeto quer bater o olho no fluxo e saber três coisas: o que já
fechou, o que está rodando em paralelo agora e quando sai a entrega final. A tela de fluxo hoje
mostra colunas de disciplinas ligadas em sequência, sem datas consolidadas e sem dizer o que um
atraso faz com a entrega. Para responder "o atraso do elétrico empurra a emissão?", ele abre
disciplina por disciplina e faz a conta de cabeça.

Duas limitações do modelo pioram isso:

1. **Dependência implícita por coluna.** Toda disciplina da coluna N espera a coluna N-1
   inteira (`ordem`). Não dá para dizer "a aprovação na prefeitura só espera a arquitetura":
   na vida real ela corre em paralelo com as complementares, e o fluxo obriga a fingir que não.
2. **Datas congeladas na aplicação do fluxo.** A cascata (`fluxoCascata.ts`) calcula as datas uma
   vez, quando o fluxo é aplicado. Se uma disciplina atrasa, as seguintes continuam mostrando a
   data antiga, e a previsão de conclusão do projeto mente.

## Objetivo

A aba Fluxo do projeto passa a funcionar como o grafo de um pipeline de CI: etapas e dependências
visíveis, status de cada disciplina, datas previstas e reais, a previsão de conclusão projetada a
partir do andamento real, e o caminho crítico (o que, se atrasar, empurra a entrega). No editor de
Fluxos, o modelo ganha dependências explícitas entre disciplinas.

**Fora de escopo:**

- Biblioteca de grafo ou de diagrama (React Flow, DHTMLX, etc.). O grafo continua desenhado à mão
  sobre o `FluxoPipelineGraph`, conforme o [ADR 0020](../architecture/adr/0020-headless-sim-widget-estilizado-nao.md).
  Layout é por colunas (`ordem`); a dependência só muda as linhas, não a posição.
- Nivelamento de recursos (mover disciplina porque a pessoa está ocupada em outro projeto).
- Dependência entre projetos diferentes.
- Tipos de vínculo além de "termina para começar" (início-início, defasagem negativa).
- Granularidade de hora na cascata (mesma decisão da 071).
- Reescrever datas salvas das disciplinas automaticamente. A projeção é calculada na tela; a data
  prevista gravada só muda quando alguém edita.

## Requisitos

### Fase 1: grafo novo sobre o modelo atual (sem migration)

Dependência continua implícita: coluna N espera a coluna N-1 inteira.

1. A aba Fluxo mostra, acima do grafo, um resumo com: progresso (disciplinas concluídas sobre o
   total), início (menor `data_inicio`), previsão de conclusão projetada, desvio em dias úteis
   contra a previsão do projeto (`projetos.data_previsao`) quando ela existe, a disciplina do
   caminho crítico que ainda não terminou e quantas disciplinas estão em andamento agora.
2. Cada coluna mostra no cabeçalho a contagem "concluídas / total", como o "8 jobs completed" de um
   pipeline.
3. Cada disciplina mostra o status (concluída, em andamento, atrasada, aguardando), o responsável e
   uma data curta: "concluída dd/mm" quando terminou, "Nd de atraso" quando está atrasada, "prev.
   dd/mm" nos demais casos.
4. Clicar numa disciplina seleciona: ela ganha destaque, as linhas que saem da coluna dela até o
   fim ficam realçadas (o que ela trava) e aparece, abaixo do grafo, o detalhe da disciplina com
   datas (início, previsão, conclusão real ou estimada), do que depende (coluna anterior), o que
   libera (coluna seguinte), se está no caminho crítico e o botão "Abrir disciplina", que abre o
   detalhe que hoje abre no clique direto.
5. As linhas do caminho crítico aparecem realçadas mesmo sem seleção.
6. A projeção de datas segue a regra:
   - concluída: fim = `data_final`;
   - em andamento: segue a previsão gravada (já começou de fato; a dependência não a empurra);
   - não iniciada: fim estimado = o maior entre a previsão gravada e o fim projetado a partir das
     dependências (início projetado = dia útil seguinte ao maior fim das dependências, mais a
     duração em dias úteis entre `data_inicio` e `data_previsao` gravados);
   - atrasada (previsão no passado, não concluída): fim estimado nunca é antes de hoje;
   - pausada: segue a previsão gravada (prazo congelado, spec 141).
7. Caminho crítico = partindo da disciplina com o maior fim estimado da última coluna, voltar pela
   dependência que determinou o início dela, até a primeira coluna.
8. Disciplina sem data (`data_previsao` vazia) não entra na projeção; o resumo diz quantas ficaram
   de fora em vez de inventar data.

### Fase 2: dependências explícitas e linha de base (migration)

9. Disciplina do projeto pode ter dependências explícitas (uma ou mais disciplinas do mesmo
   projeto). Sem nenhuma explícita, vale a regra da coluna anterior inteira: fluxos e projetos
   existentes não mudam de comportamento.
10. Dependência que formaria ciclo é recusada no banco e no front, com mensagem que diz qual
    disciplina fecha o ciclo.
11. Ao aplicar um fluxo, as datas calculadas viram a **linha de base** da disciplina
    (`data_inicio_base`, `data_fim_base`), que não muda com edição de prazo. Projeto que já tem
    disciplinas ganha a ação "Congelar linha de base agora".
12. O resumo e o detalhe passam a mostrar o desvio contra a linha de base ("era 05/02").

### Fase 3: dependências no editor de Fluxos

13. No editor de Fluxos, o grafo do modelo mostra as dependências e permite criar uma arrastando da
    borda direita de uma disciplina até outra, e remover pelo painel lateral ("Depende de").
14. O rodapé do editor mostra a duração total pelo caminho mais longo e a folga das disciplinas fora
    dele.
15. Ao aplicar o fluxo num projeto, as dependências do modelo viram dependências das disciplinas do
    projeto (requisito 9).

### Fase 4: linha do tempo do fluxo

16. A aba Fluxo ganha a visualização "Linha do tempo": barra cheia = real ou estimado, traço fino =
    linha de base, linha de hoje e caminho crítico. A matemática de posição vem de
    `src/lib/cronograma.ts` (regra do CLAUDE.md), não reimplementada na tela.

Requisitos não-funcionais:

- **Segurança / RLS:** a tabela de dependências (fase 2) tem RLS por `empresa_id` via
  `projeto_disciplinas → projetos`, no mesmo padrão de `projeto_disciplina_responsaveis`.
- **Performance:** projeção e caminho crítico são funções puras em memória, O(disciplinas +
  dependências), sobre os dados que a aba já carrega. Nenhuma consulta nova na fase 1.
- **Multi-tenant:** dependência só entre disciplinas do mesmo projeto (constraint no banco).

## Critérios de aceite

Fase 1:

- [ ] Dado um fluxo com colunas 1 e 2, quando a disciplina da coluna 1 atrasa e o fim estimado
      passa da previsão gravada, então a coluna 2 é empurrada pelo mesmo número de dias úteis e a
      previsão de conclusão do resumo muda.
- [ ] Dado duas disciplinas em paralelo na coluna 1, quando só a que termina depois atrasa, então
      o caminho crítico passa por ela e não pela outra.
- [ ] Dado uma disciplina concluída com `data_final`, então a projeção usa `data_final`, mesmo que
      seja antes ou depois da previsão.
- [ ] Dado uma disciplina atrasada, então o fim estimado é hoje (nunca no passado).
- [ ] Dado uma disciplina pausada, então a projeção usa a previsão gravada.
- [ ] Dado disciplinas sem `data_previsao`, então elas não entram na projeção e o resumo informa
      quantas ficaram de fora.
- [ ] Quando clico numa disciplina, então ela fica selecionada e o detalhe mostra do que depende, o
      que libera e o botão "Abrir disciplina", que chama o mesmo handler do clique de hoje.
- [ ] Cabeçalho de coluna mostra "concluídas/total".
- [ ] Com `prefers-reduced-motion`, nada anima (comportamento atual mantido).

Fase 2 em diante: os critérios entram nesta spec quando a fase for planejada.

## Dados e contratos

Fase 1: nenhum dado novo. Funções puras em `src/lib/fluxoGrafo.ts`:

```ts
interface NoFluxo {
  key: string;
  coluna: number; // ordem
  status: "concluido" | "em_andamento" | "atrasado" | "nao_iniciado" | "pausado";
  dataInicio?: string; // yyyy-mm-dd
  dataPrevisao?: string;
  dataFinal?: string;
  dependeDe?: string[]; // fase 2; ausente = coluna anterior inteira
}

interface ProjecaoNo {
  key: string;
  inicioEstimado?: string;
  fimEstimado?: string;
  atrasoDiasUteis: number; // fim estimado contra a previsão gravada
  critico: boolean;
}

projetarFluxo(nos: NoFluxo[], hoje: string): {
  porNo: Record<string, ProjecaoNo>;
  conclusaoEstimada?: string;
  caminhoCritico: string[]; // keys, da primeira coluna à última
  semData: number;
};
```

Fase 2 (proposta, a validar no plano da fase):

- Tabela `projeto_disciplina_dependencias (disciplina_id uuid, depende_de_id uuid)`, PK composta,
  FK com `on delete cascade` para `projeto_disciplinas`, check `disciplina_id <> depende_de_id`,
  trigger que recusa ciclo (CTE recursiva) e que recusa disciplina de outro projeto. RLS por
  empresa.
- Colunas `projeto_disciplinas.data_inicio_base date`, `projeto_disciplinas.data_fim_base date`.
- Template (`fluxos_disciplinas.etapas`, JSON): `FluxoDisciplinaTemplate` ganha `chave: string`
  (estável, gerada no editor) e `depende_de?: string[]` (chaves). `normalizeFluxoDisciplinas`
  gera `chave` para fluxos antigos; sem `depende_de`, vale a coluna anterior.

## Plano de implementação

Fase 1 (este PR):

1. `src/lib/fluxoGrafo.ts` com `projetarFluxo` e testes cobrindo os critérios de aceite da fase 1
   (dias úteis via `src/lib/businessDays.ts`).
2. `FluxoPipelineGraph`: props opcionais para contagem no cabeçalho da coluna, nó selecionado,
   realce de conectores (caminho crítico e "o que trava") e tom do rótulo de data. Os outros usos
   (prévia do editor e do wizard) não passam as props novas e ficam iguais.
3. `FluxoPipeline`: resumo no topo, seleção com painel de detalhe e botão "Abrir disciplina".
4. Antes e depois da aba Fluxo no PR (regra do dono).

Fases 2 a 4: plano próprio quando forem puxadas.

## Decisões e riscos

- **Por que reabrir o DAG que a 051 e a 071 deixaram de fora:** o dono pediu a visualização de
  pipeline, com dependências e paralelismo visíveis (2026-11-11). A régua do ADR 0020 continua
  valendo: nada de biblioteca de grafo; o layout segue em colunas e a dependência explícita só
  desenha linhas diferentes.
- **Projeção na tela, não no banco:** evita reescrever datas que o usuário gravou e mantém a
  previsão gravada como compromisso. Risco: duas fontes de "previsão" (gravada e projetada). A UI
  sempre rotula a projetada como estimada.
- **Duração derivada das datas gravadas:** na fase 1 a duração é a distância em dias úteis entre
  `data_inicio` e `data_previsao`. Disciplina sem `data_inicio` usa a previsão gravada como está,
  sem empurrar.
- **Atraso estima fim = hoje:** é o mínimo honesto. Uma "nova estimativa" informada pelo
  responsável pode entrar depois, se o uso pedir.
