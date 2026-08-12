# SPEC: Folha de pagamento, comprovante e revisão sem pedágio

**Data:** 2026-08-12
**Status:** Draft
**Autor:** Matheus (via auditoria multi-agente: UX/NN, ICP, PM)
**Módulo:** financeiro

## Problema

Todo mês o sócio fecha a folha da equipe (salário fixo + variável por m² de
produtividade, não CLT). Hoje ele: (1) é obrigado a marcar um checkbox de
"confirmar" por pessoa, cada um abrindo um modal, só pra liberar o botão de
fechar, cerimônia que não persiste nada e some no F5; (2) não consegue explicar
pra cada pessoa de onde veio o variável, porque não há comprovante e a folha
fechada perde o detalhe por projeto; (3) não filtra a lista nem compara com o
mês anterior antes de fechar, que é o momento do erro caro.

## Objetivo

O sócio fecha a folha com uma única confirmação, baixa um comprovante por
colaborador (ou o lote inteiro) com o variável destrinchado por projeto, e revisa
a folha com filtros e comparação mês a mês, sem folha CLT.

**Fora de escopo:** folha CLT (INSS/IRRF/FGTS/férias/13º/rescisão); recibo com
validade fiscal ou assinatura digital; e-mail automático do comprovante (P2);
custo de MO por projeto amarrado à rentabilidade (bloqueado por MO/timesheet
dormente, spec 023); backfill de detalhe por projeto em folhas já fechadas.

## Requisitos

Funcionais (numerados, testáveis):

1. A coluna "Confirmar" (checkbox por linha) e o gate `allConfirmed` são
   removidos. O botão "Fechar folha" fica sempre habilitado quando há dados e o
   usuário tem `canEdit`. O `CloseMonthDialog` (que já mostra contagem + total) é
   a única confirmação.
2. Ao fechar a folha, o sistema grava, por pessoa, o detalhe por projeto que
   gerou o variável (nome do projeto + m²), num snapshot que não muda se o
   projeto mudar depois.
3. Na folha fechada e no histórico, o usuário pode baixar o comprovante em PDF de
   um colaborador, com: nome, cargo, competência (mês/ano), salário fixo,
   variável destrinchado por projeto (projeto, m², valor/m², subtotal), total a
   receber, e nota de que não é holerite CLT.
4. O usuário pode baixar o lote de comprovantes da folha (um ZIP com um PDF por
   colaborador) num clique.
5. A tabela da folha tem busca por nome (preview e fechada) e filtro por status
   (só na fechada: pago/pendente/cancelado), aplicados client-side.
6. Ao editar valores de uma pessoa no preview, o variável é recalculado como
   `área × valor/m²` e o total como `fixo + variável`; um override manual do
   total só é aceito com aviso explícito de que foi desacoplado da fórmula.
7. No preview, cada linha mostra o delta do total a receber vs o mês anterior da
   mesma pessoa (quando houver folha fechada no mês anterior), e um badge de
   anomalia quando a pessoa está sem projeto no mês ou com variável zerado.

Não-funcionais:

- **Segurança / RLS:** `folha_pagamento` mantém RLS por `empresa_id`. O PDF é
  gerado no cliente a partir de dados já carregados; nenhum dado novo exposto.
- **Performance:** filtros e comparação mês anterior são client-side sobre o
  array já em memória; a comparação faz no máximo 1 query extra do mês anterior.
- **Multi-tenant:** o RPC `get_folha_preview` e o snapshot continuam presos ao
  `empresa_id` do usuário.

## Critérios de aceite

- [ ] Dado uma folha em preview com 12 pessoas, quando abro a tela, então não há
      coluna "Confirmar" e o botão "Fechar folha" está habilitado.
- [ ] Dado que fecho a folha, quando reabro a mesma folha (fechada), então cada
      pessoa mostra o detalhe por projeto que existia no preview (não vem vazio).
- [ ] Dado uma pessoa com variável vindo de 2 projetos, quando baixo o
      comprovante dela, então o PDF lista os 2 projetos com m², valor/m² e
      subtotal, e o total bate com fixo + soma dos subtotais.
- [ ] Dado uma folha fechada, quando clico em "Baixar lote", então recebo um ZIP
      com um PDF por colaborador.
- [ ] Dado uma folha fechada com status mistos, quando filtro por "pendente",
      então só as linhas pendentes aparecem.
- [ ] Caso de borda: pessoa sem `cpf`/`chave_pix` cadastrado, então o comprovante
      é gerado omitindo esses campos, sem quebrar.
- [ ] Caso de borda: ao editar o total manualmente para um valor ≠ fixo +
      variável, então aparece o aviso de valor desacoplado antes de salvar.
- [ ] Caso de borda: mês anterior sem folha fechada, então a linha não mostra
      delta (não mostra "0" nem quebra).

## Dados e contratos

- **`folha_pagamento`**: nova coluna `detalhe_projetos jsonb` (default `'[]'`),
  array de `{ nome: string, area_m2: number }`. Populada no fechamento.
- **`get_folha_preview(p_mes, p_ano)`**: passa a retornar, além do que já retorna,
  `detalhe_projetos jsonb` por pessoa: `array_agg` de `{ nome, area_m2 }` dos
  projetos onde a pessoa é responsável no período. `projetos_nomes` é mantido por
  compatibilidade (ou derivado de `detalhe_projetos` no front).
- **Front consome**: `FolhaItem` ganha `detalhe_projetos: { nome: string; area_m2:
  number }[]`, preenchido no preview (do RPC) e no closed (da coluna nova).

## Plano de implementação

1. Migration: `ALTER TABLE folha_pagamento ADD COLUMN detalhe_projetos jsonb NOT
   NULL DEFAULT '[]'::jsonb`; `DROP` + `CREATE` de `get_folha_preview` com o novo
   campo (Supabase falha silenciosamente em overload, sempre DROP + CREATE).
   Migration SÓ LOCAL primeiro; `gen:types:local`.
2. `types.ts` (folha): adicionar `detalhe_projetos` a `FolhaItem`; mapear no
   preview e no closed em `FolhaPagamento.tsx`; gravar no `handleCloseMonth`.
3. `FolhaTable.tsx`: remover coluna "Confirmar" e checkbox; manter clique na linha
   com acessibilidade de teclado; adicionar coluna/tooltip de delta vs mês
   anterior e badge de anomalia.
4. `FolhaPagamento.tsx`: remover `confirmedUsers`/`allConfirmed`/
   `ConfirmPersonDialog`; carregar total do mês anterior por pessoa; estado de
   busca + filtro de status client-side.
5. Recalcular fórmula em `saveEditing`/`DetailEditDialog` (variável e total).
6. `folhaComprovante.ts`: gerador de PDF por pessoa (reusa padrão de
   `relatorioExport.ts`, dynamic import de jsPDF+autotable) + gerador de lote ZIP.
7. Botões: "Baixar comprovante" por linha (closed) e "Baixar lote" no cabeçalho.
8. Testes dos critérios de aceite (cálculo do comprovante, filtro, recálculo).
9. `gen:types` staging + `db:push:staging` na hora do deploy (ADR 0007).

## Decisões e riscos

- **PDF no front, não edge.** jsPDF já está no projeto e é download imediato de
  poucas pessoas. Edge só se justifica quando for enviar/armazenar (P2, e-mail).
- **Snapshot não faz backfill.** Folhas fechadas antes desta mudança não têm
  detalhe por projeto; o comprovante delas sai só com os totais. Recalcular com
  dados de hoje daria número errado, então não backfill.
- **Área por projeto = área do projeto inteiro** onde a pessoa é responsável por
  disciplina, não área por disciplina (é como o cálculo atual já funciona). O
  comprovante reflete o mesmo critério do total, para não divergir.
- Bug lateral fora do escopo: dedup de despesa por `descricao` + `valor` no
  "marcar pago" colide se dois nomes iguais tiverem mesmo total. Anotado.
