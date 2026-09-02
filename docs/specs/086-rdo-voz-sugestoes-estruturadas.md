# SPEC: RDO por voz — sugestões estruturadas (fornecedor, impedimento, visita, tarefa)

**Data:** 2026-09-01
**Status:** Draft
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [080 — RDO por voz + foto](080-rdo-por-voz.md), [062 — Diário efetivo/impedimento/visita](062-diario-efetivo-por-fornecedor-impedimento-visita.md)

<!-- Origem: feedback direto de 4 testes ao vivo do usuário na spec 080 (01/09).
A spec 080 deixou de propósito fornecedor/impedimento/visita/tarefa fora do
escopo da voz, por risco de a IA vincular errado (ex.: fornecedor errado). Em
todos os 4 testes reais o usuário mencionou esses quatro itens na fala e
pediu explicitamente pra cobrir isso. Esta spec resolve o risco original com
revisão humana: a IA sugere, nada entra sem o usuário confirmar. -->

## Problema

A spec 080 entrega texto livre + clima/condição/efetivo total pela voz, mas em
todo teste real o usuário mencionou fornecedor do concreto, impedimento
(caminhão atrasado), visita (dono da obra) e tarefas do dia — e precisou
lançar cada um manualmente de novo, apesar de já ter dito tudo isso gravando.
A fricção que a voz deveria matar continua nos quatro blocos estruturados do
formulário.

## Objetivo

Depois de transcrever, o RDO por voz também sugere linhas de efetivo por
fornecedor, impedimentos, visitas e tarefas do cronograma — cada sugestão
aparece num painel de revisão, o usuário aceita ou descarta uma por uma antes
de qualquer coisa entrar no formulário. Nenhuma sugestão se torna dado sem
clique explícito.

**Fora de escopo:**

- **Inserção automática.** Mesmo com alta confiança, nenhuma sugestão vira
  linha do formulário sozinha — sempre passa pelo clique do usuário (aceitar
  ou descartar). Diferente do texto livre (spec 080), que já entra editável
  direto.
- **Criar fornecedor novo a partir da voz.** Se a IA não reconhece o nome
  falado contra o cadastro (`fornecedores`), a sugestão vem com
  `fornecedor_id: null` e o nome dito como `nome_livre` — o usuário decide se
  cadastra o fornecedor depois ou usa o texto livre (mesmo padrão já
  existente pra fornecedor não cadastrado, spec 062).
- **Criar tarefa nova a partir da voz.** Se a tarefa mencionada não bate com
  nenhuma tarefa aberta do cronograma, a sugestão não aparece pra essa menção
  — o usuário cria a tarefa manualmente (fluxo "Nova tarefa" já existe no
  formulário). Evita a IA inventar título de tarefa.
- **Reabrir Pilar Campo.** Sugestões estruturadas só no formulário do
  escritório, mesma fronteira da spec 080.

## Requisitos

Funcionais:

1. A mesma chamada de transcrição (edge `ai-rdo-voz`) recebe, além do áudio,
   a lista de fornecedores da empresa (id + nome) e as tarefas abertas do
   cronograma da obra (id + título) — dados que o front já busca
   (`useFornecedoresLite`, `useObraTarefas`). Nenhuma chamada de rede nova.
2. A resposta da edge ganha um bloco `sugestoes`, cada item já **casado**
   contra as listas enviadas quando possível:
   - `efetivo_por_fornecedor`: `{ fornecedor_id | null, fornecedor_nome,
quantidade }[]` — uma linha por grupo de pessoas mencionado (ex.: "8 da
     minha equipe" + "5 do fornecedor" viram duas linhas, não um total).
   - `impedimentos`: `{ descricao, tipo }[]`, `tipo` sempre um dos 5 valores
     do enum existente (`falta_material`, `clima`, `pendencia_projeto`,
     `mao_de_obra`, `outro`).
   - `visitas`: `{ fornecedor_id | null, fornecedor_nome, observacao |
null }[]`.
   - `tarefas`: `{ tarefa_id, resultado }[]` — **só** tarefas que a IA
     conseguiu casar com uma tarefa já aberta da lista enviada; menção sem
     correspondência não vira sugestão (requisito de escopo acima).
3. Depois de transcrever, um painel "Sugestões da fala" aparece entre a
   transcrição e os blocos estruturados existentes, listando cada item com
   um resumo de uma linha e dois botões: **Adicionar** e **Descartar**.
   Clicar Adicionar chama exatamente a mesma função que o "+" manual de cada
   bloco já usa (`adicionarEfetivo`/`adicionarImpedimento`/`adicionarVisita`/
   `toggleTarefa`) — mesmo caminho de código, sem novo estado paralelo.
4. Sugestão aceita some da lista de sugestões (evita adicionar duas vezes).
   Sugestão descartada também some, sem desfazer.
5. Nenhuma sugestão nova nesta spec pula o gate de token/rate-limit — é a
   mesma chamada de `ai-rdo-voz` já existente, só com payload maior.
6. Zero sugestões (fala não mencionou nada estruturado, ou não bateu com
   nada do cadastro): painel não aparece, formulário segue como na spec 080.

Não-funcionais:

- **Qualidade do casamento fornecedor/tarefa:** a lista de fornecedores e
  tarefas enviada ao Gemini é a fonte de verdade pro `id` — a IA nunca inventa
  um id que não está na lista (valida via schema Zod: `fornecedor_id`/
  `tarefa_id` só aceitam um dos ids da lista enviada, ou `null`).
- **Payload:** empresas com cadastro de fornecedor muito grande (não há hoje,
  mas o design não pode quebrar) — se a lista de fornecedores passar de ~200
  itens, truncar e avisar em log (não é caso real hoje, não vale complicar
  agora).
- **Custo de IA:** o payload maior aumenta tokens de entrada; segue o mesmo
  débito/gate já existente (ADR 0035), sem teto novo.

## Critérios de aceite

- [ ] Dado um áudio mencionando "5 pessoas da minha equipe e 3 do fornecedor
      Concreto Mix" (fornecedor cadastrado), quando a transcrição processa,
      então aparecem 2 sugestões de efetivo por fornecedor, uma com
      `fornecedor_id` da Concreto Mix preenchido.
- [ ] Dado um áudio mencionando um fornecedor que não existe no cadastro,
      quando a transcrição processa, então a sugestão de efetivo/visita vem
      com `fornecedor_id: null` e o nome dito, sem quebrar.
- [ ] Dado um áudio mencionando "faltou cimento", quando a transcrição
      processa, então aparece sugestão de impedimento com
      `tipo=falta_material`.
- [ ] Dado um áudio mencionando uma tarefa que bate com uma tarefa aberta do
      cronograma, quando a transcrição processa, então aparece sugestão de
      tarefa com o `tarefa_id` certo e resultado plausível
      (avançou/concluiu/parou) a partir do que foi dito.
- [ ] Dado um áudio mencionando uma tarefa que **não** existe no cronograma,
      quando a transcrição processa, então nenhuma sugestão de tarefa aparece
      pra essa menção (sem inventar).
- [ ] Dado uma sugestão de impedimento na lista, quando clico "Adicionar",
      então uma linha nova aparece no bloco Impedimentos (mesmo efeito do "+"
      manual) e a sugestão some da lista.
- [ ] Dado uma sugestão qualquer, quando clico "Descartar", então ela some da
      lista sem afetar o formulário.
- [ ] Caso de borda: áudio sem menção estruturada nenhuma (só clima/atividade
      solta) — painel de sugestões não aparece.
- [ ] `npm run test:run` e `npm run typecheck` verdes.

## Dados e contratos

Sem tabela nova. Muda o contrato de `ai-rdo-voz`:

```
POST /functions/v1/ai-rdo-voz
Body: {
  audioBase64: string,
  mimeType: string,
  fornecedores: Array<{ id: string; nome: string }>,   // novo
  tarefasAbertas: Array<{ id: string; titulo: string }>, // novo
}
Resposta 200: {
  transcricao, clima, condicao_trabalho, efetivo,
  atividades, ocorrencias, pendencias,                  // igual à spec 080
  sugestoes: {
    efetivo_por_fornecedor: Array<{ fornecedor_id: string | null; fornecedor_nome: string; quantidade: number }>,
    impedimentos: Array<{ descricao: string; tipo: TipoImpedimento }>,
    visitas: Array<{ fornecedor_id: string | null; fornecedor_nome: string; observacao: string | null }>,
    tarefas: Array<{ tarefa_id: string; resultado: "avancou" | "concluiu" | "parou" }>,
  }
}
```

Schema Zod da edge valida `fornecedor_id`/`tarefa_id` contra os ids
recebidos no request (allowlist dinâmica via `.refine()`), não contra um enum
fixo — rejeita/retenta se a IA inventar um id fora da lista.

Front: `useTranscreverRdoVoz` passa a receber `fornecedores`/`tarefasAbertas`
(já disponíveis no `RdoFormDialog` via hooks existentes) e devolve o campo
`sugestoes` extra. Novo componente `SugestoesVozPanel` (ou bloco inline)
dentro de `RdoFormDialog.tsx`, com estado local `sugestoes` (as 4 listas,
inicialmente vazias, preenchidas após transcrever, removendo item por item
conforme aceito/descartado).

## Plano de implementação

1. **`ai-rdo-voz/index.ts`**: aceitar `fornecedores`/`tarefasAbertas` no
   body; montar o prompt incluindo as duas listas (nome/id) com instrução
   clara pra só usar id da lista ou `null`; estender `RdoVozSchema` com o
   bloco `sugestoes`, usando `.refine()` pra validar que todo `fornecedor_id`/
   `tarefa_id` não-nulo está nas listas recebidas (fecha o requisito não
   funcional do casamento).
2. **`useTranscreverRdoVoz.ts`**: aceitar os dois arrays novos no input da
   mutation, tipar o retorno com `sugestoes`.
3. **`RdoFormDialog.tsx`**: passar `fornecedores` (já tem via
   `useFornecedoresLite`) e as tarefas abertas (filtrar `tarefas` existente
   por não-concluídas) na chamada de `processarAudioGravado`; guardar
   `sugestoes` em estado; renderizar o painel entre a transcrição e o bloco
   Clima; cada linha chama a função de adicionar já existente do bloco
   correspondente e remove-se da lista de sugestões.
4. **Testes**: schema Zod da edge (allowlist de id) via `deno check`/teste
   manual; função pura de "resumo de uma linha" da sugestão, se extraída,
   testada; `npm run typecheck`/`test:run`.
5. **Verificação manual**: repetir um dos áudios reais já usados nos testes
   anteriores (fornecedor Concreto Mix, impedimento de caminhão, visita do
   João, tarefa concretar laje) e conferir as 4 sugestões + aceitar cada uma.

## Decisões e riscos

- **Decisão:** sugestão sempre passa por confirmação humana — resolve
  exatamente o risco que a spec 080 apontou ("a IA pode vincular fornecedor
  errado") sem abrir mão da automação. Precedente já existe no código
  (`agent_runs.status = 'pending_review'`, hoje sem produtor ativo) — esta é
  a primeira feature a usar esse padrão de fato.
- **Decisão:** tarefa só sugere quando casa com uma tarefa **já aberta** do
  cronograma; não cria tarefa nova pela voz. Cria tarefa nova é ação de
  intenção clara demais pra delegar a um match difuso de fala.
- **Risco:** lista de fornecedores/tarefas no prompt aumenta tokens de
  entrada e, em tese, chance de a IA se confundir com nomes parecidos (ex.:
  dois fornecedores "Concreto Mix" e "Concreto Master"). Mitigado pela
  revisão humana obrigatória — pior caso é a sugestão errada, descartável com
  um clique, nunca dado sujo direto no banco.
- Nenhuma decisão de arquitetura transversal (extensão de padrão `ai-*` já
  existente); não abre ADR novo.
