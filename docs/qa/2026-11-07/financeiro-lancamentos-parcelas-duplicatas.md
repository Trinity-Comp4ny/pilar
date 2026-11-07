# Diagnóstico: Financeiro (lançamentos, parcelas, pagamentos e duplicatas)

**Data:** 2026-11-07
**Escopo:** módulo Financeiro ativo (Lançamentos, parcelamento, baixa de pagamento, importação de extrato, detecção de duplicata).
**Método:** leitura do código (front + migrations/RPCs). Nenhum teste em browser ainda: cada achado cita o arquivo e a linha para ser reproduzido.

Contexto anterior: [catálogo QA 2026-07-20](../2026-07-20/catalogs/04-financeiro.md), [SPEC 033](../../specs/033-lancamentos-fonte-unica-filtros-parcelas.md), [SPEC 017](../../specs/017-importacao-extrato-e-fatura-por-arquivo.md).

---

## Resumo

O financeiro já tem as peças certas no banco (`grupos_parcela`, RPCs atômicas de parcelamento, renegociação, quitação antecipada, soft delete via RPC, hash de importação), mas **o front não usa várias delas** e cada caminho de escrita tem a sua regra. O resultado: parcelados criados pela tela ficam "pela metade", a detecção de duplicata tem três lógicas diferentes e alguns caminhos sem nenhuma, e a baixa de pagamento não modela pagamento parcial, juros ou desconto.

---

## 1. Bugs de dado (corrigir primeiro)

| # | Achado | Onde | Efeito |
|---|---|---|---|
| B1 | **Parcelado criado pelo formulário não cria a linha em `grupos_parcela`.** O form gera `crypto.randomUUID()` e grava só nas parcelas. A RPC atômica `rpc_grupo_parcela_criar` existe e não é usada pela UI. | `LancamentoFormDialog.tsx:159,272` · `20260874000000_financeiro_delegado_rpcs_diretas.sql:139` | "Editar em aberto", "Renegociar" e "Quitar antecipado" fazem `SELECT ... FROM grupos_parcela` e falham com "Grupo não encontrado". `grupo_status` e `grupo_total_original` vêm `null` na view. O trigger de status do grupo retorna cedo. |
| B2 | **Inserção do parcelado não é atômica.** Insere as N parcelas e depois chama `rpc_lancamento_set_rateio` uma vez por parcela, em loop. | `LancamentoFormDialog.tsx:272-280` | Se o rateio falhar na parcela 5, as 12 parcelas ficam gravadas e só 4 com rateio. |
| B3 | **Editar receita recebida apaga a data real do recebimento.** Grava `data_recebimento = data_vencimento`. Na despesa o código preserva `data_efetivacao`; na receita não. | `LancamentoFormDialog.tsx:170` | Fluxo de caixa e conciliação passam a mostrar a receita no dia do vencimento, não no dia em que o dinheiro entrou. |
| B4 | **Excluir lançamento é exclusão física** (`.delete()`), apesar do soft delete via RPC existir para `receitas`/`despesas`. | `LancamentosTable.tsx:312,314` · `20260859000000_soft_delete_via_rpc.sql` | Sem "desfazer", sem trilha de auditoria, sem lixeira. Excluir parcela de um grupo não recalcula o total original. |
| B5 | **Extrato importado entra como `Pendente`** com vencimento no passado. | `useImportFinanceiro.ts:307,322` | Linha de extrato é movimento que já aconteceu. Entra como "a pagar" e o job `rpc_atualizar_status_atrasados` marca como **Atrasado** na rodada seguinte, inflando KPIs de atraso. |
| B6 | **O hash de importação é gravado e nunca consultado.** Não há índice único nem checagem antes de inserir. | `importFinanceiro.ts:266` · `useImportFinanceiro.ts:311,326` | Importar dois extratos com período sobreposto duplica as linhas em comum. |
| B7 | **Marcar como pago/recebido pela lista não pede conta.** O form exige conta para lançamento efetivado; a baixa pela lista, em massa e no swipe do mobile, não. | `LancamentosTable.tsx:212-290` · `lancamentoFormSchema.ts` (refine de conta) | Lançamento pago sem conta: o saldo da conta não bate com o extrato. O mesmo vale para `rpc_grupo_parcela_quitar_antecipado`, que não recebe conta. |
| B8 | **Status "Atrasado" é gravado no banco por job**, e o select de status do form só oferece Pendente/Pago. | `000_base_schema.sql:1305` · `LancamentoFormDialog.tsx:323` | Editar um lançamento atrasado mostra o select vazio. Adiar o vencimento para o futuro mantém "Atrasado" até alguém mudar à mão. |

---

## 2. Duplicatas: como funciona hoje

Existem **três regras diferentes** e caminhos sem nenhuma:

| Caminho | Regra hoje | Problema |
|---|---|---|
| Form manual (`lib/duplicateCheck.ts`) | descrição **idêntica** (sem o sufixo "(1/3)", ignorando caixa) + valor ±1% + vencimento ±5 dias | Não olha **fornecedor/cliente**, **nota fiscal** nem conta/cartão. "Aluguel escritório" × "Aluguel do escritório" passa. Roda só na criação, nunca na edição. Consulta no client. |
| Importação (`encontrarDuplicata`) | mesmo tipo + valor exato + data ±3 dias, **sem descrição** | Usa `.find()`: pega o primeiro que casar. Duas linhas de R$ 500 no extrato podem conciliar **o mesmo** pendente. Dois pendentes de R$ 500 (fornecedores diferentes) na mesma semana: concilia o errado. A lista de pendentes é buscada sem paginação e o PostgREST corta em 1.000 linhas (`config.toml: max_rows`). |
| Folha | descrição + valor | Regra própria, não compartilhada. |
| Quick add, agentes de IA (RPCs), edição, transferência | **nenhuma** | Duplo Enter no quick add e agente que roda duas vezes gravam em dobro. |

O aviso também é fraco: só "Salvar mesmo assim" ou "Cancelar". Não abre o lançamento existente, não mostra a diferença campo a campo e não lembra que o usuário já disse "não é duplicata". Por isso volta a perguntar toda vez que um lançamento recorrente legítimo se repete.

### Proposta: um motor só, no servidor, com pontuação

`rpc_buscar_duplicatas(tipo, valor, data, descricao, contraparte_id, nota_fiscal, conta_id, cartao_id, excluir_id)`, usado por **todos** os caminhos (form, quick add, importação, agentes, folha), devolvendo candidatos com nível de confiança:

| Sinal | Confiança | Ação na UI |
|---|---|---|
| Mesma **nota fiscal** + mesma contraparte | Certeza | Bloqueia, com link para o lançamento existente. Índice único parcial `(empresa_id, tipo, contraparte_id, nota_fiscal) WHERE deleted_at IS NULL AND nota_fiscal IS NOT NULL`. |
| Mesmo hash/FITID de importação na mesma conta | Certeza | Linha marcada "já importada" no preview, desmarcada por padrão. Índice único `(empresa_id, conta_id, import_line_hash)`. |
| Mesma contraparte + valor exato + data ±3 dias | Alta | Aviso forte, comparação lado a lado. |
| Descrição parecida (`pg_trgm` `similarity > 0.6`, extensão já instalada) + valor ±1% + data ±5 dias | Média | Aviso leve. |

Regras de exclusão, para cortar falso positivo:

- Parcelas do **mesmo grupo** nunca são duplicata entre si.
- Lançamento de uma **série recorrente** (aluguel, software) não é duplicata do mês anterior da mesma série.
- Par marcado "não é duplicata" fica gravado (`duplicata_ignorada` com os dois ids) e não volta a ser perguntado.

Na importação, a conciliação vira **pareamento 1:1 por pontuação**: cada pendente casa com uma linha no máximo, usando valor, data, descrição e contraparte. Na tela de revisão aparece "conciliado com X (confiança alta)", com troca manual.

Opcional, como segunda fase: varredura periódica que mostra um banner "3 possíveis duplicatas" na lista de lançamentos, para pegar o que entrou por caminhos antigos.

---

## 3. Parcelamento

**Lógica**

1. **Criar pela RPC atômica** (`rpc_grupo_parcela_criar`) e estender a RPC para receber o rateio. Resolve B1 e B2 de uma vez. Migration de backfill para os `grupo_parcela` órfãos já gravados (mesmo `INSERT ... SELECT` da `20260504000001`).
2. **Uma regra de competência só.** Hoje o form grava a mesma competência em todas as parcelas e a RPC grava competência = vencimento de cada parcela. Para o ICP as duas existem: compra parcelada tem competência na compra; honorário parcelado de contrato tem competência por parcela ou medição. Deixar isso explícito no form ("Competência: na data da compra / em cada parcela"), com padrão por tipo.
3. **Tirar o "(1/3)" do texto da descrição.** `parcela_numero` e `parcela_total` já existem. O sufixo embutido atrapalha busca, renomear o grupo e a própria detecção de duplicata (que precisa removê-lo com regex). Exibir o "3/12" pela coluna.
4. **Plano flexível:** entrada + parcelas, valores diferentes por parcela, datas editáveis e periodicidade (a RPC já aceita mensal/bimestral/trimestral/semestral/anual e até 360 parcelas; o form só faz mensal e até 60).
5. **Editar parcela com escopo**, como no Google Agenda: "só esta / esta e as próximas / todas em aberto". Hoje editar uma parcela isolada não atualiza o `total_original` do grupo e o resumo fica errado.
6. **Quitação antecipada não deve sobrescrever `valor`.** Hoje o desconto é rateado reescrevendo o valor da parcela e o valor original se perde (fica só na observação). Guardar `desconto` separado (ver seção 4).

**UI do grupo** (`GrupoParcelaActions.tsx`)

- "Novo valor por parcela" e "Desconto" usam `<Input type="number">` (linhas 176, 343). Precisam ser `MoneyInput`: digitar "1.234,56" vira `NaN`.
- Os três diálogos montam `Dialog` + footer à mão. Pela regra do design system, devem usar `FormDialog`.
- Cartão do grupo no detalhe: barra de progresso k/N, total pago × saldo, próxima parcela e a lista das parcelas como linha do tempo, cada uma clicável. `get_grupos_parcela_resumo` já devolve esses números.
- Preview no form antes de salvar: tabela com as N parcelas (data e valor), editável.

---

## 4. Pagamento e baixa

Hoje a baixa é binária: muda o status e grava uma data. Para escritório de projeto isso é pouco, porque cliente paga parcial, paga com atraso e com multa, e fornecedor dá desconto.

1. **Diálogo único "Registrar pagamento"** (substitui o "marcar pago" da lista, do swipe, do bulk e da quitação): data, **conta (obrigatória)**, valor pago, juros/multa, desconto e comprovante. Resolve B7.
2. **Pagamento parcial:** tabela `lancamento_baixas` (n baixas por lançamento) ou colunas `valor_pago`, `juros`, `multa`, `desconto`. O status passa a ser derivado: Pendente → Parcial → Pago. Recomendação: tabela de baixas, porque permite várias entradas e casa com a conciliação de extrato (uma linha do extrato = uma baixa).
3. **"Atrasado" derivado, não gravado:** `status = Pendente AND data_vencimento < hoje`, calculado na view e na RPC de página. Remove o job e resolve B8.
4. **Exclusão por soft delete** com toast "Desfazer" (resolve B4) e, em parcela de grupo, a mesma escolha de escopo da edição.
5. **Anexo de comprovante/NF no lançamento.** Hoje não existe no módulo (só na folha).

---

## 5. UI e experiência

- **Tela "A pagar / A receber" por urgência:** atrasados, hoje, 7 dias, 30 dias, com baixa em um clique (já com conta e data). É a pergunta que o dono faz toda manhã; hoje a resposta exige filtrar a lista.
- **Detalhe do lançamento como painel lateral**, não modal: dados, grupo de parcelas, baixas, anexos e histórico (quem criou e quem mudou o quê; o `handle_record_audit` já grava).
- **Conciliação como fluxo próprio:** extrato à esquerda, lançamentos à direita, pareamento sugerido pelo motor de duplicatas, com aceitar ou trocar. Substitui o "conciliar" escondido dentro da importação.
- **Diálogo de duplicata melhor:** comparação lado a lado, botão "abrir existente", "é a mesma, cancelar", "não é duplicata (não perguntar de novo)".
- **Feedback de grupo na lista:** a linha-grupo já tem resumo (SPEC 033). Falta mostrar "renegociado de…" quando o grupo veio de renegociação (`renegociado_de` existe e não aparece).

---

## 6. Ordem sugerida

| Onda | Conteúdo | Por quê |
|---|---|---|
| **1. Integridade** (pequena, só correção) | B1+B2 (form via RPC atômica + backfill dos órfãos), B3, B4 (soft delete + desfazer), B5 (extrato entra como Pago), B6 (índice único do hash + checagem), B7 (conta obrigatória na baixa), `MoneyInput` nos diálogos de grupo | Dado errado hoje, correções localizadas, sem mudança de modelo. |
| **2. Motor de duplicatas** | `rpc_buscar_duplicatas` com pontuação, NF única, pareamento 1:1 na importação, "não é duplicata" lembrado, diálogo novo, aplicado em todos os caminhos (incluindo agentes e quick add) | Uma regra só, no servidor, que vale para todas as entradas. |
| **3. Modelo de pagamento** | `lancamento_baixas`, parcial/juros/desconto, status derivado (fim do "Atrasado" gravado), diálogo "Registrar pagamento", anexo de comprovante | Muda schema e precisa de spec própria. |
| **4. Parcelamento flexível + UI** | Plano com entrada e valores/datas editáveis, escopo de edição, competência explícita, descrição sem sufixo, tela A pagar/A receber, painel de detalhe, conciliação lado a lado | Experiência; depende das ondas 1 a 3. |

Cada onda vira uma SPEC em `docs/specs/` antes de implementar. Mudança visual segue a regra de antes e depois no PR.
