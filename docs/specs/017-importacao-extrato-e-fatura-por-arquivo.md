# SPEC: Importação de extrato e fatura por arquivo (PDF/Excel/CSV)

**Data:** 2026-07-31
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** financeiro (+ IA)

> **Estado (2026-07-31):** fundação entregue e verificada (typecheck + 414 testes + lint).
> Pronto: migration `20260731100000` (import_batch_id/hash), núcleo determinístico
> `src/lib/importFinanceiro.ts` (CSV, valor/data BR, hash, dedupe) com 23 testes, edge
> function `ai-import-financeiro`, hook `useImportFinanceiro`, tela "Importar" (aba do
> Financeiro) com preview editável, conciliação leve por linha e desfazer em sessão.
> **Falta:** (1) extração automática de texto de PDF no client (hoje: colar o texto) —
> exige `pdfjs-dist`, avaliar `npm audit`; (2) XLSX (hoje só CSV) — exige SheetJS, avaliar
> audit; (3) fatura de cartão vinculada a `faturas`/`gerar_fatura` (hoje entra como
> despesa simples); (4) aplicar a migration em staging + `gen:types` real + deploy da edge
> (o `types.ts` já continha as colunas por drift prévio); (5) ADR de privacidade; (6)
> testes de `gravarLote`/`desfazer`.

Antecipada como fase futura em [spec 016](./016-conta-da-obra-e-prestacao-de-contas.md)
("Conciliação bancária / importação de extrato OFX", fora de escopo daquela fase). É a
mitigação estrutural do risco da tela vazia citado na 016 e na lição do timesheet:
lançamento manual mais lento que a planilha mata o uso.

## Problema

O cliente já tem o controle financeiro do mês pronto: extrato do banco em PDF, fatura de
cartão em PDF, ou uma planilha de gastos em Excel. Hoje, para esse dado virar número no
Pilar, ele digita lançamento por lançamento. É a fricção que mais aparece no pedido
("me pediram muito"): quem já exporta o extrato mensal do banco não aceita redigitar.
Quem sente: o sócio/financeiro do escritório de engenharia (ICP) no fechamento do mês, e
o escritório que administra a obra do cliente (spec 016), que precisa lançar dezenas de
despesas da conta da obra.

## Objetivo

Depois desta feature: o usuário sobe um PDF (extrato ou fatura), Excel ou CSV, o sistema
extrai a lista de movimentos, sugere tipo (entrada/saída), categoria e possível duplicata,
o usuário **revisa e corrige numa tabela**, e confirma a importação em lote, populando o
Financeiro sem digitação manual.

Métrica de sucesso: importar um extrato mensal real (30-80 linhas) e ter os lançamentos
corretos no Financeiro em menos de 3 minutos, com o usuário só revisando/ajustando, não
digitando do zero.

**Fora de escopo (v1):**

- **PDF escaneado / foto de comprovante (sem camada de texto).** Por decisão de
  privacidade (ver Requisitos), o v1 extrai o **texto** do PDF localmente e manda só texto
  pro modelo. PDF que é imagem pura (sem texto selecionável) precisaria de OCR/multimodal e
  fica **fora do v1**. O caso alvo (extrato/fatura exportado do banco) é PDF digital.
- **Conexão automática com o banco (Open Finance / agregador).** Aqui o dado entra por
  arquivo que o usuário baixa e sobe. Integração bancária direta é fase futura.
- **Hospedar o arquivo importado.** O PDF/Excel é processado e **descartado**; o Pilar
  não vira repositório de extratos (alinha com a decisão de anexo por link, 30/07). Só o
  resultado estruturado (os lançamentos) e um rótulo de origem persistem.
- **Tela de conciliação bancária dedicada.** A conciliação no v1 é **leve e embutida** no
  preview (detecção de duplicata linha a linha, ver Req. 5). Uma tela de conciliação
  completa (saldo do extrato x saldo do sistema, fechamento) é fase futura.
- **Rateio automático por centro de custo / projeto por IA.** A importação pode herdar um
  projeto/categoria escolhido pelo usuário para o lote, mas não adivinha rateio.

## Requisitos

Funcionais:

1. O usuário abre "Importar" no Financeiro, escolhe o **tipo de documento** (extrato
   bancário | fatura de cartão | planilha de gastos) e sobe um arquivo **PDF, XLSX/XLS ou
   CSV** (limite de tamanho e nº de páginas definidos no plano).
2. O sistema **extrai** os movimentos e devolve uma lista de lançamentos candidatos, cada
   um com: data, descrição, valor, **tipo sugerido** (`despesa`/`receita`, inferido pelo
   sinal), **categoria sugerida** (casada com as `categorias_financeiras` da empresa) e
   **confiança** por linha. Excel/CSV usa parsing determinístico (mapeando colunas); PDF
   tem o **texto extraído localmente** e só o texto é enviado ao modelo para estruturação
   (decisão de privacidade, ver não-funcionais).
3. O usuário vê os candidatos numa **tabela editável (preview)**: pode corrigir qualquer
   campo, mudar categoria, remover linhas, e definir em massa **conta bancária/cartão** e
   **projeto** (opcional) do lote. **Nada é gravado antes da confirmação explícita** (HITL
   obrigatório para dado financeiro).
4. Ao confirmar, o sistema **insere em lote** em `despesas` e/ou `receitas` conforme o
   tipo de cada linha, com `empresa_id`, `status` inicial, `conta_id`/`cartao_id`,
   `categoria_id`, `projeto_id` e um **rótulo de origem** que permite desfazer o lote.
5. **Detecção de duplicata (conciliação leve):** para cada candidato, o sistema procura em
   `despesas`/`receitas` uma conta **pendente** com valor igual e vencimento próximo
   (janela de dias configurável). Se achar, a linha do preview oferece **"marcar existente
   como pago/recebido"** (efetiva a conta: seta `status` + `data_pagamento`/
   `data_recebimento` + `conta_id`) em vez de criar duplicata. O usuário decide por linha.
6. **Desfazer importação:** o usuário pode reverter um lote recém-importado (remove os
   lançamentos criados por aquele `import_batch_id`; efetivações de duplicata revertem para
   `Pendente`), enquanto nenhum deles foi editado manualmente depois.
7. **Fatura de cartão:** ao importar como fatura de cartão, os itens entram como despesas
   vinculadas ao cartão/fatura no modelo existente (`faturas` + `gerar_fatura`); parcelas
   detectadas ("2/12") preenchem `parcela_numero`/`parcela_total`.

Não-funcionais:

- **Segurança / privacidade (decidido):** o conteúdo do documento é **dado financeiro
  sensível**. Decisão: extrair o **texto** do PDF localmente e enviar ao modelo (Gemini,
  ver ai-client.ts) **só o texto**, nunca a imagem do extrato; Excel/CSV nem passa pelo
  modelo (parsing determinístico). O arquivo bruto **não é persistido**. Ainda assim, o
  texto do extrato sai do perímetro para o Google, então: aviso claro no upload + ADR de
  privacidade registrando o trade-off.
- **RLS / multi-tenant:** inserts vão para `despesas`/`receitas`, que já têm RLS por
  `empresa_id = get_user_empresa_id()`. A edge function resolve `empresa_id` pelo usuário
  autenticado (padrão ai-fechamento-mensal), nunca confia em `empresa_id` vindo do client.
  Nenhum lançamento cruza empresa.
- **Custo / rate limit:** reusar `checkRateLimit(empresaId)` e registrar em `ai_usage_logs`
  (padrão ai-\*). PDF longo custa por página; limitar páginas e tamanho por importação.
- **Validação na fronteira:** o JSON devolvido pelo modelo é validado por **Zod** antes de
  virar preview; linha fora do shape é descartada com aviso, não gravada torta.
- **Idempotência:** dois uploads do mesmo arquivo não devem duplicar silenciosamente;
  hash por linha (data+valor+descrição) alimenta a detecção de duplicata do Req. 5.

## Critérios de aceite

- [ ] Dado um extrato bancário PDF digital com 40 linhas, quando importo, então vejo 40
      candidatos com data/descrição/valor corretos e tipo (entrada/saída) inferido pelo
      sinal, e nenhum é gravado antes de eu confirmar.
- [ ] Dado um CSV/Excel com colunas em ordem diferente do padrão, quando importo, então o
      sistema mapeia as colunas para data/descrição/valor e produz os candidatos corretos.
- [ ] Dado um candidato de R$ 3.000 em 10/07 e uma despesa **pendente** de R$ 3.000 com
      vencimento 10/07 já cadastrada, então o preview oferece "marcar como paga" e, ao
      escolher, a despesa existente vira `status='Pago'` com `data_pagamento=10/07` **sem**
      criar uma segunda despesa.
- [ ] Dado que confirmei um lote de 40 lançamentos, quando clico em desfazer (e nenhum foi
      editado depois), então os 40 somem do Financeiro e as efetivações de duplicata voltam
      a `Pendente`.
- [ ] Dada uma fatura de cartão PDF com uma compra "Loja X 2/12 R$ 200", quando importo
      como fatura, então a despesa entra vinculada ao cartão/fatura com
      `parcela_numero=2`, `parcela_total=12`.
- [ ] Caso de borda: linha do documento sem valor numérico reconhecível é marcada como
      "revisar" e **não** é gravada na confirmação até o usuário preencher.
- [ ] Caso de borda: usuário de outra empresa não consegue importar para dados de terceiro;
      a edge function ignora qualquer `empresa_id` do client e usa o do token.
- [ ] Caso de borda: arquivo acima do limite de tamanho/páginas é rejeitado com mensagem
      clara (o que houve + o próximo passo), sem chamar o modelo.
- [ ] `npm run test:run` e `npm run typecheck` verdes; testes do parser Excel/CSV, da
      validação Zod do retorno do modelo, do matching de duplicata e do desfazer lote.

## Dados e contratos

**Edge function nova** (padrão de `ai-fechamento-mensal`, `_shared/cors.ts` +
`checkRateLimit` + `ai_usage_logs`):

```
POST /functions/v1/ai-import-financeiro
  auth: Bearer (usuário) → empresa_id resolvido no servidor
  body: { tipo: 'extrato'|'fatura'|'planilha', arquivo: base64|texto, mime }
  resposta (validada por Zod): {
    lancamentos: Array<{
      data: string (ISO),
      descricao: string,
      valor: number,            // sempre positivo
      tipo: 'despesa'|'receita',
      categoria_sugerida_id: uuid|null,
      parcela_numero?: number, parcela_total?: number,
      confianca: number         // 0..1
    }>,
    avisos: string[]            // linhas ignoradas / ambíguas
  }
```

- **Excel/CSV**: parsing determinístico no client ou na função (lib de planilha); o modelo
  entra só se o mapeamento de colunas for ambíguo. **PDF**: extrai o texto localmente (lib
  de PDF→texto) e manda só o texto pro modelo — reusa `callGeminiStructured` como está, sem
  precisar de input multimodal.
- **Gravação**: reusa o caminho de insert existente (`despesas`/`receitas`; para fatura,
  `gerar_fatura`). Não criar um segundo motor de lançamento.

**Alteração de schema** (migration + `npm run gen:types`, staging primeiro, ADR 0007) —
fecha o gap de rastreio de origem/dedupe (hoje `despesas`/`receitas` não têm
`idempotency_key`, ao contrário de `faturas`):

```sql
alter table public.despesas
  add column import_batch_id uuid,
  add column import_line_hash text;
alter table public.receitas
  add column import_batch_id uuid,
  add column import_line_hash text;
-- índice parcial para o desfazer e a detecção de duplicata
create index on public.despesas (import_batch_id) where import_batch_id is not null;
create index on public.receitas (import_batch_id) where import_batch_id is not null;
```

## Plano de implementação

Preenchido/refinado em plan mode e aprovado antes de gerar código. Esboço:

1. Migration: colunas `import_batch_id`/`import_line_hash` em `despesas` e `receitas` +
   índices; `gen:types`; commitar `types.ts` (staging, ADR 0007).
2. Parser determinístico Excel/CSV em `src/lib/` (puro, testável): mapeia colunas →
   candidatos, infere tipo pelo sinal.
3. Edge function `ai-import-financeiro`: auth → empresa_id → `checkRateLimit` → extração
   (Excel/CSV determinístico; PDF → texto local, depois `callGeminiStructured` com JSON
   schema) → validação Zod → retorno.
4. Hook `useImportFinanceiro` + tela de importação: upload, chamada, **preview editável**,
   ajustes em massa (conta/projeto), detecção de duplicata por linha (Req. 5).
5. Gravação em lote (insert `despesas`/`receitas` com `import_batch_id`; efetivar duplicata
   quando escolhido) + desfazer lote.
6. Fatura de cartão: vínculo via `gerar_fatura`, parcelas.
7. Testes dos critérios + QA (dark mode, empresa com/sem categorias cadastradas, extrato de
   2-3 bancos diferentes).

## Decisões e riscos

- **Decisão (2026-07-31):** conciliação no v1 é **leve embutida** no preview (Req. 5), não
  tela dedicada. Conciliação plena fica pra fase futura.
- **Decisão (2026-07-31) — abrir ADR:** privacidade tratada extraindo o **texto** do PDF
  localmente e mandando só texto ao Gemini (nunca a imagem); Excel/CSV não passa pelo
  modelo. Mesmo assim o texto do extrato sai pro Google, então o ADR registra o trade-off e
  o upload avisa o usuário. PDF imagem pura (sem texto) fica fora do v1.
- **Risco (acurácia) — confiança e HITL:** extração de PDF erra (OCR de números, sinais
  trocados). Mitigação: campo de confiança por linha, preview obrigatório, nada grava sem
  confirmação. Nunca lançar direto no banco.
- **Risco (duplicata):** importar o mesmo extrato duas vezes ou sobre contas já lançadas.
  Mitigação: `import_line_hash` + detecção de duplicata + desfazer lote.
- **Risco (custo):** PDF longo custa por página e pode estourar o teto mensal de IA da
  empresa. Mitigação: limite de páginas/tamanho, rate limit, preferir parsing determinístico
  em Excel/CSV. Amarra ao pricing (créditos de IA).
- **Dependência:** confirmar no plano o nome real das colunas/caminho de insert de
  `despesas`/`receitas` e o fluxo de `gerar_fatura` para cartão.

```

```
