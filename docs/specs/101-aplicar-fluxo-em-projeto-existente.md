# SPEC: Aplicar fluxo de disciplinas em projeto já criado

**Data:** 2026-10-06  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** projetos

## Problema

O fluxo de disciplinas (spec 071) só pode ser escolhido no wizard de criação do
projeto. Escritório que começou a usar o Pilar com projetos já em andamento, ou
que criou o projeto antes de montar o fluxo, só consegue adicionar disciplina
avulsa: perde a ordem em colunas, a cascata de datas, o checklist padrão e a
visão Fluxo. Pedido direto de cliente.

## Objetivo

Na aba Disciplinas de um projeto existente, aplicar um fluxo da empresa e o
projeto passar a seguir esse fluxo, sem apagar nem reescrever o que já foi feito.

**Fora de escopo:** trocar o fluxo de um projeto que já segue um; remover o
fluxo aplicado; sincronizar mudança futura do template com projetos que já o usam.

## Requisitos

1. Quem pode editar o projeto vê "Aplicar fluxo" na aba Disciplinas (tabela, e
   no estado vazio da visão Fluxo) enquanto nenhuma disciplina do projeto tem
   coluna de fluxo (`ordem_etapa`) e existe ao menos um fluxo ativo na empresa.
2. O modal mostra o seletor de fluxo, a data de início da cascata e a prévia do
   resultado em colunas.
3. A data de início padrão é a maior entre o início do projeto e hoje (projeto
   em andamento não ganha disciplina nova com início no passado).
4. Disciplina do fluxo que **não existe** no projeto é criada com coluna, datas
   da cascata, responsáveis e checklist padrão (mesmo resultado do wizard).
5. Disciplina do fluxo que **já existe** no projeto (mesmo nome, sem diferenciar
   maiúscula, acento ou espaço nas pontas) só recebe a coluna do fluxo. Status,
   datas, responsáveis, checklist e observações dela ficam como estão.
6. Disciplina do projeto que não está no fluxo continua no projeto, como avulsa.
7. A prévia informa quantas serão criadas e quantas já existem e serão mantidas.

## Critérios de aceite

- [ ] Dado projeto sem disciplinas, quando aplico um fluxo de 3 disciplinas, então
      3 disciplinas são criadas com coluna, datas da cascata e checklist.
- [ ] Dado projeto com "Estrutural" Em Andamento, quando aplico um fluxo que tem
      "estrutural", então ela ganha a coluna do fluxo e mantém status e datas, e
      nenhuma duplicata é criada.
- [ ] Dado projeto com disciplina avulsa fora do fluxo, quando aplico, então ela
      continua lá sem coluna.
- [ ] Dado projeto com início em 2026-01-10 e hoje 2026-10-06, então a data de
      início padrão da cascata é 2026-10-06.
- [ ] Dado projeto que já segue um fluxo, então "Aplicar fluxo" não aparece.
- [ ] Dado usuário sem permissão de edição, então "Aplicar fluxo" não aparece.

## Dados e contratos

Sem migration. Usa `projeto_disciplinas.ordem_etapa`,
`projeto_disciplina_checklist` e `projeto_disciplina_checklist_responsaveis`,
já com RLS por empresa. A inserção reaproveita o mesmo caminho do save em lote
do wizard (`useBulkSaveDisciplinas`).

## Plano de implementação

1. `planejarAplicacaoFluxo` (pura, `src/lib/fluxoCascata.ts`): recebe fluxo,
   disciplinas do projeto e data de início; devolve `novas` e `encaixadas`. Teste.
2. Extrair a criação de disciplina com checklist do save em lote para um helper
   e criar `useAplicarFluxoNoProjeto`.
3. `AplicarFluxoDialog` (`FormDialog`) com seletor, data e prévia.
4. Botão na tabela de disciplinas e estado vazio na visão Fluxo.

## Decisões e riscos

- Casar por nome normalizado é heurística: disciplina renomeada à mão
  ("Estrutural - Rev2") entra como nova. A prévia mostra o que vai acontecer
  antes de confirmar.
- Gravação é client-side em vários passos (mesmo padrão do wizard). Falha no
  meio deixa parte aplicada; o erro é mostrado e o botão some só quando alguma
  disciplina ganhou coluna, então dá pra completar à mão.
