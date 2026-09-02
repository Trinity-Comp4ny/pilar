# SPEC: Proposta em níveis de detalhe (FIN-3)

**Data:** 2026-08-27
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** propostas

<!-- Origem: FIN-3 do Mapa de Melhorias ("Relatório de proposta em níveis de
detalhe — só o total / por fases / itens com preço / completo, mesmo dado").
Escopo revisado ao pesquisar o código: ao contrário da maioria dos itens
"novo" auditados nesta sessão, este é genuinamente novo — o sistema de
geração de documento (upload de template .docx com {{variáveis}},
docxtemplater, preview via mammoth, envio por e-mail) já existe e é sólido
(GerarPropostaDialog.tsx), mas a variável de disciplinas hoje só devolve uma
lista de NOMES (`DISCIPLINAS: "Estrutural, Elétrico, Hidráulico"`) — o preço
por fase que já existe no dado (`valor_venda`, `horas_estimadas`,
`custo_hora` de cada disciplina) nunca chega no documento. -->

## Problema

O documento que o cliente recebe hoje mostra só o valor total da proposta.
Quebrar por disciplina — quanto de cada etapa, com ou sem hora/preço unitário
— exige o sócio montar isso à mão fora do Pilar, ou não mostrar nada. O T2B
não tem proposta exportável nenhuma; aqui o documento já existe, só falta
essa camada de detalhe.

## Objetivo

O sócio escolhe, ao desenhar o template .docx (não no momento de gerar —
ver "Decisões"), qual nível de detalhe das disciplinas aparece no documento,
inserindo a variável correspondente. Mesmo dado (`disciplinas` da proposta),
três granularidades novas além do total que já existe:

1. **Só o total** — já existe (`{{VALOR_PROPOSTO}}`), sem mudança.
2. **Por fases** — nome de cada disciplina, uma por linha.
3. **Itens com preço** — nome + valor de cada disciplina, uma por linha.
4. **Completo** — nome + horas + custo/hora + valor de cada disciplina.

**Fora de escopo:**

- **Seletor de nível no momento de gerar o documento.** O nível de detalhe é
  decidido pelo TEMPLATE (qual variável o sócio colocou no .docx), não por um
  toggle na tela de geração — mesmo padrão do resto do sistema hoje (todo
  controle de conteúdo é via template, não via UI). Menos um passo a mais no
  wizard de 3 passos que já existe.
- **Tabela nativa via loop do docxtemplater** (`{{#disciplinas}}...{{/disciplinas}}`).
  Exigiria adicionar o módulo de loop ao `generateDocx`, ensinar sintaxe nova
  de template, e o preview (mammoth) não necessariamente renderiza bem
  tabelas geradas por loop. A alternativa mais simples e já compatível com
  tudo que existe: variáveis de texto pré-formatado com quebra de linha
  (`linebreaks: true` já ligado no gerador).
- **PDF.** O documento continua `.docx`, como hoje.

## Requisitos

Funcionais:

1. Três novas variáveis automáticas, além de `DISCIPLINAS` (mantida como
   está, lista de nomes só):
   - `DISCIPLINAS_FASES`: uma disciplina por linha, só o nome.
   - `DISCIPLINAS_COM_VALOR`: uma disciplina por linha, `Nome — R$ valor`.
   - `DISCIPLINAS_DETALHADO`: uma disciplina por linha,
     `Nome — Nh × R$ custo/h — R$ valor`.
2. Cada linha usa `valor_venda` da disciplina quando existir; se não (proposta
   antiga sem esse campo calculado), calcula `horas_estimadas × custo_hora`.
3. Proposta sem nenhuma disciplina cadastrada: as três variáveis retornam
   string vazia (o template não quebra, só não mostra nada onde a variável
   estava).
4. As três novas variáveis aparecem no editor de template
   (`VariaveisGuideDialog`/lista de `AUTO_VARIABLES`) com a mesma explicação
   que as demais, para o sócio saber que existem ao montar um template.

Não-funcionais:

- **Sem migration.** `disciplinas` (nome, horas, custo/h, valor_venda) já
  chega em `buildVariableData` via `GerarPropostaDialog` — só estende a
  função pura, mesmo padrão das variáveis existentes.
- **Sem quebra de template existente.** `DISCIPLINAS` continua exatamente
  como está; as três novas são aditivas.

## Critérios de aceite

- [x] Dada uma proposta com 2 disciplinas (`Estrutural`, `valor_venda`
      R$12.000; `Elétrico`, `valor_venda` R$8.500), quando gero o documento
      com um template usando `{{DISCIPLINAS_COM_VALOR}}`, então o resultado
      mostra as duas linhas com nome e valor formatado em R$.
- [x] Mesmo cenário com `{{DISCIPLINAS_DETALHADO}}`: cada linha mostra horas,
      custo/hora e valor.
- [x] Disciplina sem `valor_venda` mas com `horas_estimadas`/`custo_hora`:
      `DISCIPLINAS_COM_VALOR` calcula `horas × custo_hora` pra essa linha.
- [x] Proposta sem disciplinas: as três variáveis novas resultam em string
      vazia, sem erro no `generateDocx`.
- [x] `DISCIPLINAS` (a variável antiga) continua devolvendo só os nomes
      separados por vírgula, sem mudança de comportamento.
- [x] `npm run test:run` verde (742 testes, 6 novos em `docxUtils.test.ts`).
- [x] Verificado ao vivo: as 3 variáveis aparecem no "Guia de Variáveis"
      (`/gestao/propostas` → Templates → Guia de Variáveis) com descrição e
      exemplo, logo abaixo de `{{DISCIPLINAS}}`.

## Dados e contratos

Nenhuma tabela nova, nenhuma migration. `src/lib/docxUtils.ts`:
`AUTO_VARIABLES` ganha 3 entradas; `buildVariableData` ganha 3 campos
calculados a partir do `disciplinas` que já recebe.

## Plano de implementação

1. Estender `AUTO_VARIABLES` e `buildVariableData` em `docxUtils.ts` + testes
   (função pura, sem rede — os 5 critérios de aceite viram testes diretos).
2. Confirmar que `VariaveisGuideDialog`/onde quer que `AUTO_VARIABLES` seja
   listado hoje já pega as 3 novas automaticamente (é um `Record`, deve ser
   automático — checar, não assumir).
3. `npm run typecheck` + `npm run test:run`.
4. Verificar no browser: proposta real com disciplinas, subir um template de
   teste com `{{DISCIPLINAS_DETALHADO}}`, gerar e conferir o preview.

## Decisões e riscos

- **Decisão:** nível de detalhe é escolha de TEMPLATE, não de UI. Mantém o
  wizard de 3 passos como está (config → preview → enviar) e usa o padrão já
  estabelecido (o sócio monta o .docx do jeito que quer, o Pilar só
  preenche). Uma tela de "escolher nível" seria uma 4ª decisão no meio do
  fluxo pra um caso que o próprio template já resolve.
- **Risco:** se o sócio nunca souber que essas variáveis existem, o recurso
  fica invisível — por isso o requisito 4 (aparecer no guia de variáveis).
- Nenhuma decisão de arquitetura transversal; não abre ADR.
