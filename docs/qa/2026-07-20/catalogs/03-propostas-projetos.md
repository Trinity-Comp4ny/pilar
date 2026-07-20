# QA — Propostas e Projetos (Escopos, Aditivos, Disciplinas, Marcos, Orçamento)

Ambiente: banco LOCAL (127.0.0.1), app http://localhost:8080. Login workhorse: `admin@pilar.local` / `Pilar@2026`.
Banco começa vazio: a maioria dos casos depende de construir dado antes (cliente → proposta → projeto).
Escopo analisado: `src/pages/propostas/`, `src/pages/Projetos.tsx`, `src/pages/projetos/**`, `src/pages/Calendario.tsx`,
hooks `usePropostas.ts`, `useProjetoForm.ts`, RPC `rpc_converter_proposta_projeto`, triggers de aditivo, RPCs de marco/parcela.

Pré-requisito para quase tudo: ter ao menos 1 cliente e 1 lead cadastrados (módulo Clientes/Leads).

---

## PARTE A — Casos de teste para o browser

Legenda prioridade: P0 = bloqueia release / dinheiro errado · P1 = alto · P2 = médio · P3 = cosmético.

### Propostas

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| PROP-01 | Criar proposta (caminho feliz) | /propostas → "Nova Proposta" | Preencher título, cliente, valor, prazo, validade; salvar | — | Proposta criada, aparece na lista, código sugerido PROP-00x, validade default +30d | P1 |
| PROP-02 | Título obrigatório vazio | Dialog Nova Proposta | Deixar título vazio, salvar | Título = "" ou só espaços | Toast "Título é obrigatório"; não cria | P1 |
| PROP-03 | Código duplicado | Dialog Nova Proposta | Usar código de proposta já existente | "PROP-001" repetido | **Só avisa em texto âmbar, NÃO bloqueia o submit** (ver ACH-PROJ-11). Verificar se salva mesmo assim | P2 |
| PROP-04 | Valor com vírgula/ponto trocado | Campo Valor Proposto | Digitar "1.234,56", "1234.56", "1.234.567" | Máscara pt-BR; confирmar valor parseado correto | Máscara trata dígitos como centavos; conferir se "1234.56" vira R$ 1.234,56 e não R$ 123.456,00 | P1 |
| PROP-05 | Valor gigante | Campo Valor | Digitar 999999999999 | overflow numérico | Aceita ou trava com clareza; sem NaN na lista/soma | P2 |
| PROP-06 | Área/prazo negativos | Campos Área (m²) / Prazo (dias) | Digitar -50 na área e -10 no prazo | valores negativos | **Sem validação atual**; prazo negativo quebra a data de previsão na conversão (ver ACH-PROJ-12) | P1 |
| PROP-07 | Disciplinas: soma diverge do valor | Editor de disciplinas + Valor | Somar disciplinas ≠ valor digitado | soma 10k, valor 5k | Mostra "difere do valor digitado" + botão "usar a soma"; não bloqueia | P2 |
| PROP-08 | Disciplina com custo > valor de venda (margem negativa) | Editor de disciplinas | horas×custo > valor_venda | custo 10000, venda 100 | Badge margem exibe valor negativo em vermelho; salva mesmo assim | P2 |
| PROP-09 | Disciplina com horas/custo negativos | Editor de disciplinas | Digitar -5 horas / -100 custo | negativos | Inputs têm `min={0}` mas aceitam colar negativo; conferir custo total | P2 |
| PROP-10 | Salvar disciplinas falha mas proposta salva | Dialog (editar) | Simular erro RPC (offline no meio) | rede cai após update | Toast "Proposta salva, mas houve erro ao salvar as disciplinas"; **valor_proposto pode ter virado a soma sem as disciplinas persistidas** (ver ACH-PROJ-13) | P2 |
| PROP-11 | XSS em título/observação | Dialog Nova Proposta | Título = `<img src=x onerror=alert(1)>` e `<script>` | payload XSS | React escapa no app (texto puro); confirmar que na geração de DOCX/contrato o payload não é injetado | P1 |
| PROP-12 | Duplo submit criar | Dialog | Clicar "Criar Proposta" 2x rápido | double click | Botão desabilita com isPending; não deve criar 2 propostas | P1 |
| PROP-13 | Excluir proposta + desfazer | Lista → menu → Excluir | Excluir, clicar "Desfazer" no toast | — | Soft delete (deleted_at); "Desfazer" restaura | P2 |
| PROP-14 | Proposta expirada | Lista | Criar proposta com validade no passado | validade < hoje | Status exibido "expirada" (só display, não persistido); ainda permite converter | P3 |
| PROP-15 | Filtro por data (validade/criação) | Popover Filtros | De > Até (intervalo invertido) | De=2026-12, Até=2026-01 | Não quebra; lista vazia coerente | P3 |

### Conversão proposta → projeto

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| CONV-01 | Converter com disciplinas | /propostas → detalhe → "Converter em Projeto" | Proposta com 3 disciplinas → converter | — | Projeto criado; **aba Disciplinas do projeto deve vir populada** (relacional), orçamento por fase preenchido, SmartInvoice abre | P0 |
| CONV-02 | Disciplinas vêm certas | Após CONV-01, abrir projeto | Conferir aba Disciplinas, Orçamento e Cronograma | — | `projeto_disciplinas` (nome, horas, custo_hora), `projeto_orcamento_fases` (com valor_venda e margem_alvo). Conferir que nome/horas/custo batem com a proposta | P0 |
| CONV-03 | Converter proposta de LEAD | Proposta vinculada a lead (sem cliente) | Converter | lead_id preenchido, cliente_id null | Lead promovido a cliente (status Ganho), projeto recebe o cliente, proposta atualizada. Verificar no módulo Leads/Clientes | P0 |
| CONV-04 | Reconverter proposta já convertida | Proposta com projeto_id | Tentar converter de novo | dupla conversão | RPC lança "Proposta já foi convertida"; não cria projeto duplicado | P1 |
| CONV-05 | Converter sem disciplinas | Proposta sem disciplinas | Converter | zero disciplinas | Projeto criado sem orçamento/disciplinas; sem erro | P2 |
| CONV-06 | Prazo → data_previsao | Proposta com prazo 60 dias → converter | Conferir data_previsao do projeto | prazo 60 | data_previsao = hoje + 60 dias **corridos** (RPC usa dias-calendário; projeto manual usa dias úteis — inconsistência ACH-PROJ-06) | P2 |
| CONV-07 | Converter com prazo negativo | Proposta com prazo = -10 (via PROP-06) | Converter | prazo negativo | data_previsao anterior a data_inicio; sem validação (ACH-PROJ-12) | P2 |
| CONV-08 | Duplo submit converter | Dialog "Criar Projeto" | Clicar 2x | double click | Botão desabilita com isPending; guarda de projeto_id impede duplicado | P1 |

### Projetos (criar do zero / editar / excluir)

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| PROJ-01 | Criar projeto do zero (wizard 3 passos) | /projetos → "Novo Projeto" | Preencher Identificação, Escopo&Prazo, Disciplinas; salvar | — | Projeto criado; disciplinas relacionais salvas; aparece no Kanban | P0 |
| PROJ-02 | Obrigatórios vazios (passo 1) | Wizard passo 1 | Deixar código/nome/cliente vazios, avançar | vazios | Erros inline nos 3 campos; foca o primeiro; não avança | P1 |
| PROJ-03 | Data final < data início | Passo 2 Prazos | Início 2026-12-01, Previsão/Final 2026-01-01 | data invertida | DatePicker de previsão/final usa minDate=início. **Mas se inverter a ordem de edição (setar previsão e depois adiantar início) a inversão persiste** (ACH-PROJ-07) | P1 |
| PROJ-04 | Prazo em dias úteis calcula previsão | Passo 2 | Início + Prazo (dias úteis) = 60 | 999 / 0 / negativo | Prazo 1–999 recalcula previsão pulando fim de semana; fora do range é ignorado | P2 |
| PROJ-05 | Valor com máscara | Passo 2 Valor | "1234,56" vs "1.234,56" | trocar separadores | Máscara centavos; parseCurrencyString coerente com o exibido | P1 |
| PROJ-06 | Parcelas + dia fixo de pagamento | Passo 2 (só criação) | Parcelas=3, Dia=25 | dia=31, dia=0, dia=45 | Gera receitas vencendo dia 25; dia fora de 1–31 é ignorado no client; conferir fev/dia 31 | P2 |
| PROJ-07 | Disciplina do projeto: datas fora do prazo | Passo 3 | Disciplina com início < início do projeto ou fim > previsão | datas fora | Toast "Datas inválidas" bloqueia salvar | P1 |
| PROJ-08 | Disciplina pendente não incluída | Passo 3 | Preencher temp disciplina, NÃO clicar "Incluir", salvar | esquecer de incluir | Safety net inclui automaticamente + toast informativo | P2 |
| PROJ-09 | Remover último responsável | Passo 3 / detalhe disciplina | Tentar remover o único responsável | — | Toast "precisa ter ao menos um responsável" | P3 |
| PROJ-10 | Responsável duplicado | Passo 3 | Adicionar o mesmo responsável 2x | dup | Toast "Responsável já adicionado" | P3 |
| PROJ-11 | CEP inválido / ViaCEP offline | Passo 1 Localização | Digitar CEP inexistente 00000000 | CEP falso | Toast "CEP não encontrado"; não trava o form | P2 |
| PROJ-12 | Descartar alterações não salvas | Qualquer passo | Editar e fechar dialog | — | AlertDialog "Descartar alterações?" | P2 |
| PROJ-13 | Rascunho de novo projeto persiste | Novo Projeto | Preencher parte, fechar, reabrir | — | useFormPersist restaura (TTL 24h) só em criação | P3 |
| PROJ-14 | Excluir projeto com escopos/marcos/receitas | Kanban → card → Excluir | Excluir projeto que tem aditivo aprovado + marco faturado | — | **Escopos/marcos cascateiam; receitas NÃO são apagadas, viram órfãs (projeto_id=NULL)** — copy do dialog diz "todos os dados removidos" e engana (ACH-PROJ-14) | P0 |
| PROJ-15 | Duplo submit salvar projeto | Wizard passo 3 | Clicar "Salvar" 2x | double click | Botão desabilita com isSaving | P1 |
| PROJ-16 | Navegar para /projetos/:id inexistente | URL direta | Abrir `/projetos/00000000-0000-0000-0000-000000000000` | UUID válido inexistente | Fica em loading infinito? Deve mostrar erro/empty (ACH-PROJ-15) | P1 |
| PROJ-17 | Navegar para /projetos/:id malformado | URL direta | `/projetos/abc` | não-UUID | Query falha; conferir que não crasha (tela branca) | P2 |
| PROJ-18 | XSS em nome/observação do projeto | Wizard | Nome = `<script>alert(1)</script>` | XSS | React escapa; conferir no mapa/tooltip/relatórios | P1 |
| PROJ-19 | Código de projeto duplicado | Wizard passo 1 | Reusar código existente | dup | Sem checagem no client; RPC pode falhar → toast "Erro ao salvar" com mensagem crua | P2 |

### Escopos e Aditivos

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| ESC-01 | Definir escopo original | Detalhe projeto → aba Escopo | Criar escopo tipo Original com itens | — | Nasce status "aprovado"; badge "Escopo original definido" | P2 |
| ESC-02 | Criar aditivo + aprovar | Aba Escopo → "Novo Aditivo" | Criar aditivo com itens/disciplina, enviar p/ aprovação, aprovar | — | Ao aprovar: valor_contrato += valor_aditivo, orçamento atualizado, **e uma receita é criada automaticamente** (efeito silencioso não avisado — ACH-PROJ-05) | P0 |
| ESC-03 | Aditivo aprovado recalcula valor total | Antes/depois de ESC-02 | Anotar valor_contrato antes; aprovar; conferir depois | — | valor_contrato exato = anterior + valor_aditivo (sem duplicar apesar de 2 triggers) | P0 |
| ESC-04 | Aditivo com itens SEM disciplina | Aba Escopo → Novo Aditivo | Adicionar itens deixando o Select Disciplina vazio; aprovar | disciplina null | **Aprovação FALHA silenciosa** (trigger tenta inserir disciplina NULL em coluna NOT NULL) → toast genérico "Não foi possível atualizar o status" (ACH-PROJ-02) | P0 |
| ESC-05 | Valor do aditivo negativo | Dialog Novo Aditivo → Valor | Digitar -5000 | negativo | min=0 no input mas aceita colar; **trigger SUBTRAI do valor_contrato** (ACH-PROJ-04) | P1 |
| ESC-06 | Itens com custo/horas negativos | Dialog Aditivo → itens | custo -1000 | negativo | Sem min nos inputs de item; custo/sugestão ficam negativos (ACH-PROJ-09) | P2 |
| ESC-07 | Orçamento vs contrato divergem | Após aprovar aditivo | Comparar total do orçamento (aba Orçamento) com valor_contrato | — | **valor_venda no orçamento = custo×1,3 por item, mas contrato soma valor_aditivo manual → divergem** (ACH-PROJ-03) | P1 |
| ESC-08 | Aprovar/rejeitar exige confirmação | Aba Escopo | Aprovar e rejeitar aditivo | — | ConfirmDialog em ambos; copy correta | P3 |
| ESC-09 | Sugestão de valor (custo+30%) | Dialog Aditivo | Adicionar itens sem tocar no valor | — | Valor acompanha custo×1,3 até o usuário editar (touched) | P3 |

### Orçamento por fases

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| ORC-01 | Adicionar linha de orçamento | Detalhe → aba Orçamento | Adicionar disciplina sem orçamento; salvar | — | Linha criada; custo total = horas×custo/h (coluna gerada) | P2 |
| ORC-02 | Editar horas/custo recalcula | Aba Orçamento | Clicar linha, alterar horas | valores grandes/negativos | Custo total e margem recalculam; conferir margem quando venda=0 (divisão) | P1 |
| ORC-03 | Excluir linha e re-adicionar mesma disciplina | Aba Orçamento | Excluir "Elétrico", re-adicionar "Elétrico" | — | **Falha silenciosa: UNIQUE(projeto_id,disciplina) ignora soft-delete → toast "Erro"** (ACH-PROJ-08) | P1 |
| ORC-04 | Margem com venda zero | Aba Orçamento | Linha com valor_venda=0 | divisão por zero | Resumo protege (totalVenda>0); mas linha isolada margem_alvo pode confundir | P2 |
| ORC-05 | Salvar sem horas | Aba Orçamento | disciplina sem horas | horas=0 | handleSave exige `editRow.horas_estimadas` truthy → 0 bloqueia silenciosamente (sem feedback) | P3 |

### Marcos de faturamento

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| MARCO-01 | Criar marco | Detalhe → aba Faturamento | Nome, valor, %, data prevista; criar | — | Marco pendente; totais atualizam | P2 |
| MARCO-02 | Soma dos marcos ≠ valor do projeto | Aba Faturamento | Criar marcos somando mais/menos que valor_contrato | soma 200% do contrato | **Sem validação nem aviso** de que a soma diverge do contrato | P1 |
| MARCO-03 | % do contrato > 100 | Dialog Novo Marco | Percentual = 250 | >100 | Aceita sem validação; só exibe | P2 |
| MARCO-04 | Faturar marco cria receita | Aba Faturamento | Clicar faturar (ícone banknote) | — | rpc_faturar_marco cria receita; marco vira "faturado"; segundo clique barrado (guard status) | P1 |
| MARCO-05 | Excluir marco já faturado | Aba Faturamento | Excluir marco status=faturado | — | ConfirmDialog avisa "receita fica órfã"; **receita NÃO é removida** (integridade — ACH-PROJ-16) | P1 |
| MARCO-06 | "Gerar Parcelas" repetido | Aba Faturamento | Clicar "Gerar Parcelas" 3x | cliques repetidos | **Cada clique cria 3 novas receitas (hardcoded 3/30d), sem dedup → receitas duplicadas** (ACH-PROJ-01) | P0 |
| MARCO-07 | Valor/nome vazios | Dialog Novo Marco | Salvar sem nome/valor | vazios | Throw "Nome e valor são obrigatórios" → toast "Erro" (mensagem crua no throw, não amigável) | P3 |
| MARCO-08 | Data prevista no passado | Dialog Novo Marco | Data prevista = ano passado | passado | Aceita sem aviso | P3 |

### Calendário

| ID | Fluxo | Rota/onde | Passos | Input adversarial | Resultado esperado | Prio |
|---|---|---|---|---|---|---|
| CAL-01 | Prazos aparecem no mês certo | /calendario | Navegar meses; conferir disciplinas com data_fim | fuso | Datas batem com o cadastrado; conferir se `T00:00:00` não empurra p/ dia anterior por fuso | P2 |
| CAL-02 | Filtro por projeto/responsável | /calendario | Aplicar filtros | — | Filtra corretamente; responsáveis únicos vêm das disciplinas | P3 |

---

## PARTE B — Achados estáticos (bugs no código)

| ID | Sev | Categoria | Arquivo:linha | Cenário concreto | Evidência |
|---|---|---|---|---|---|
| ACH-PROJ-01 | 🔴 | math/integridade | `BillingMilestonesTab.tsx:128-142,171-178` + `000_base_schema.sql` (rpc_gerar_parcelas_projeto) | Botão "Gerar Parcelas" chama a RPC com 3 parcelas/30d **fixos** e sem nenhuma checagem de idempotência. Cada clique insere 3 novas `receitas`. Clicar N vezes = 3N receitas duplicadas contando como receita no financeiro. | RPC faz `FOR i IN 1..p_num_parcelas LOOP INSERT INTO receitas ...` sem verificar se já existem parcelas do projeto. UI não desabilita após primeiro uso. Ainda: o `UPDATE ... WHERE descricao LIKE '%Parcela N/N'` do ajuste de centavos casa com parcelas de execuções anteriores. |
| ACH-PROJ-02 | 🟠 | silent-failure/validação | `EscopoTab.tsx:174-186` + `000_base_schema.sql:894-911` (handle_escopo_aprovado) | Aditivo cujos itens ficam sem disciplina (Select opcional → `disciplina: item.disciplina || null`). Ao aprovar, o trigger faz `INSERT INTO projeto_orcamento_fases (... disciplina ...) VALUES (v_item.disciplina ...)` com NULL numa coluna `disciplina TEXT NOT NULL` → exceção → o UPDATE de aprovação inteiro falha. UI mostra só "Não foi possível atualizar o status". | `escopo_itens.disciplina` é nullable e o form permite vazio; `projeto_orcamento_fases.disciplina` é NOT NULL (`005_orcamento_marcos_faturas.sql`). |
| ACH-PROJ-03 | 🟠 | math/corretude | `000_base_schema.sql:899-919` (handle_escopo_aprovado) | Ao aprovar aditivo, o orçamento por fase recebe `valor_venda = custo × 1,3` por item, mas o `valor_contrato` do projeto recebe `+ valor_aditivo` (valor manual editado pelo usuário). Os dois quase nunca batem → total do orçamento diverge do valor de contrato exibido. | `valor_venda ... COALESCE(v_item.custo,0)*1.3` vs `valor_contrato = ... + NEW.valor_aditivo`. O valor manual não é distribuído no orçamento. |
| ACH-PROJ-04 | 🟠 | validação/math | `EscopoTab.tsx:153-156,542-553` | Valor do aditivo aceita negativo (input `min="0"` é só validação de form, não impede digitar/colar; `parseFloat` mantém o sinal). O trigger soma ao contrato → **subtrai** do valor_contrato e cria receita negativa. | `parseFloat(formValorAditivo) || totalCusto*1.3`; trigger `valor_contrato = COALESCE(valor_contrato,0) + NEW.valor_aditivo`. Sem `Math.max(0,...)`. |
| ACH-PROJ-05 | 🟡 | silent-failure/UX | `EscopoTab.tsx:228-239` + `000_base_schema.sql:151-188` (aditivo_aprovado_handler) | Aprovar aditivo dispara DOIS triggers: `handle_escopo_aprovado` (contrato+orçamento) e `aditivo_aprovado_handler` (prazo + **cria receita automática** do valor_aditivo). A UI só avisa "Orçamento do projeto atualizado" — a receita a receber criada em silêncio surpreende no financeiro. | Dois triggers ativos: `trigger_escopo_aprovado` (AFTER) e `escopo_aditivo_aprovado` (BEFORE) — `000_base_schema.sql:4008,4212`. O segundo faz `INSERT INTO receitas ...`. |
| ACH-PROJ-06 | ⚪ | data-fuso/corretude | migration `20260713020000...:102-105` | Conversão proposta→projeto calcula `data_previsao = CURRENT_DATE + prazo_estimado_dias dias corridos`. Projeto criado manualmente calcula previsão em **dias úteis** (`addBusinessDays`). Mesmo "prazo" gera previsões diferentes conforme a origem. | RPC usa `CURRENT_DATE + (prazo || ' days')::INTERVAL`; `useProjetoForm.ts:274` usa `addBusinessDays`. |
| ACH-PROJ-07 | 🟡 | data/estado | `useProjetoForm.ts` (sem revalidação) + `ProjetoFormDialog.tsx:566-583` | DatePicker de previsão/final usa `minDate=data_inicio`, mas isso só limita no momento da escolha. Se o usuário escolhe previsão e depois **adianta o início para uma data posterior**, a previsão inválida (anterior ao início) permanece; não há revalidação no submit para as datas do próprio projeto (só valida disciplinas vs projeto). | `handleSubmit` valida só datas das disciplinas contra o projeto (`useProjetoForm.ts:542-569`); nada checa `data_previsao >= data_inicio` do projeto. |
| ACH-PROJ-08 | 🟠 | integridade/silent-failure | `ProjectBudgetTab.tsx:72-81,93-103` + constraint `orcamento_unique_projeto_disciplina` | Excluir uma linha de orçamento faz soft-delete (trigger `soft_delete_generic` seta `deleted_at`). Re-adicionar a mesma disciplina tenta INSERT e colide com o índice `UNIQUE(projeto_id, disciplina)` que **não filtra deleted_at** → erro genérico "Erro", sem explicar. | `CONSTRAINT orcamento_unique_projeto_disciplina UNIQUE (projeto_id, disciplina)` em `005_...`; delete usa `.delete()` (soft) e insert não trata conflito. |
| ACH-PROJ-09 | 🟡 | validação | `EscopoTab.tsx:506-519` | Inputs de horas/custo dos itens do aditivo não têm `min` nem sanitização; `parseFloat(...)||0` aceita negativos. Custo total e sugestão de valor podem ficar negativos, contaminando orçamento ao aprovar. | `onChange={... parseFloat(e.target.value) || 0}` sem `Math.max`. |
| ACH-PROJ-10 | 🟡 | validação/math | `BillingMilestonesTab.tsx:146-150` (sem checagem) | Não há validação de que a soma dos marcos = valor_contrato, nem aviso quando diverge. Marcos podem somar 300% do contrato sem alerta. Idem `percentual` (aceita >100). | `totalMarcos = marcos.reduce(...)` sem comparar com o contrato; input percentual sem max. |
| ACH-PROJ-11 | ⚪ | validação | `propostas/index.tsx:178-180,885-887` | Código de proposta duplicado só mostra texto âmbar "Já existe uma proposta com este código"; `handleSubmit` **não bloqueia** o salvamento. Dá para criar propostas com código repetido. | `codigoDuplicado` é usado só para renderizar aviso; não referenciado em `handleSubmit`. |
| ACH-PROJ-12 | 🟡 | validação/data | `propostas/index.tsx:993-998` + conversão | Prazo estimado aceita negativo (`parseInt(e.target.value) || undefined`; sem min). Ao converter, `CURRENT_DATE + (-N days)` gera previsão anterior ao início. | Sem `min` no input; RPC não trata prazo negativo. |
| ACH-PROJ-13 | 🟡 | corretude/estado | `propostas/index.tsx:230-261` | No submit, `valor_proposto` pode ser sobrescrito pela soma das disciplinas; a persistência das disciplinas é separada e, se falhar, mostra toast mas **o form fecha** deixando a proposta com valor da soma sem as disciplinas correspondentes salvas (estado inconsistente). | `valorProposto = valorManual || soma`; `persistDisciplinas` roda depois do update, com `onError` que só avisa e chama `done()`. |
| ACH-PROJ-14 | 🟠 | integridade/UX | `Projetos.tsx:103-117` + FK `receitas_projeto_id_fkey ON DELETE SET NULL` | Excluir projeto é **hard delete** (`.from("projetos").delete()`). Escopos/marcos/orçamento cascateiam, mas `receitas.projeto_id` é `ON DELETE SET NULL` → as receitas (dinheiro) permanecem no financeiro **órfãs**, sem vínculo ao projeto. O ConfirmDialog afirma "Todos os dados do projeto serão removidos", o que é enganoso. | `000_base_schema.sql:4781` `receitas_projeto_id_fkey ... ON DELETE SET NULL`; `ConfirmDialog` em `Projetos.tsx:452-461`. |
| ACH-PROJ-15 | 🟠 | silent-failure/estado | `ProjetoDetail.tsx:45-53` + `useProjetoDetail.ts` | `/projetos/:id` com UUID válido inexistente: `if (loading || !projeto) return <Loader/>`. Se a query resolve sem dado, `projeto` fica falsy e a tela pode ficar em spinner permanente (sem estado de "não encontrado"). | Guard único `loading || !projeto` sem ramo de erro/empty. Confirmar comportamento no browser (PROJ-16). |
| ACH-PROJ-16 | 🟡 | integridade | `BillingMilestonesTab.tsx:114-126` | Excluir marco faturado hard-deleta o marco; a receita gerada (`receita_id`, FK `ON DELETE SET NULL`) permanece órfã. Só há aviso textual no ConfirmDialog, sem oferecer remover/estornar a receita. | `deleteMutation` faz `.delete()` do marco; `marcos_faturamento_receita_id_fkey ON DELETE SET NULL` (`000_base_schema.sql:4531`) protege a receita, mas ela fica sem marco. |
| ACH-PROJ-17 | ⚪ | corretude | `propostas/index.tsx:232-233` | Não dá para definir explicitamente valor_proposto = 0: `parseCurrencyString("")` retorna 0 (falsy) e cai na soma das disciplinas. Proposta "de cortesia" com valor zero e disciplinas listadas não é possível. | `valorManual || (soma>0 ? soma : undefined)`. |
| ACH-PROJ-18 | ⚪ | data-fuso | `propostas/index.tsx:356` / `BillingMilestonesTab.tsx:144` | Datas exibidas com `new Date(d + "T00:00:00")` usam meia-noite **local**; em ambientes com TZ negativo isso é seguro, mas a mistura com `new Date().toISOString().split("T")[0]` (UTC) para `data_faturada` pode gravar o dia seguinte perto da meia-noite. | `data_faturada = new Date().toISOString().split("T")[0]` (UTC) vs exibição local. |
| ACH-PROJ-19 | ⚪ | corretude | migration `20260713020000...:101` | Conversão sempre grava `data_inicio = CURRENT_DATE`, ignorando qualquer expectativa de início futuro. Projeto convertido nasce "começando hoje". | `VALUES (... CURRENT_DATE, ...)` fixo. |

---

## Resumo

- **Parte A:** 61 casos de teste (PROP 1-15, CONV 1-8, PROJ 1-19, ESC 1-9, ORC 1-5, MARCO 1-8, CAL 1-2).
- **Parte B:** 19 achados — 🔴 1 · 🟠 6 · 🟡 7 · ⚪ 5.
- **Top 3 mais graves:**
  1. 🔴 ACH-PROJ-01 — "Gerar Parcelas" duplica receitas a cada clique (RPC sem idempotência, botão sem trava) → dinheiro inflado no financeiro.
  2. 🟠 ACH-PROJ-14 — excluir projeto é hard delete e deixa receitas órfãs (ON DELETE SET NULL), com copy que promete apagar tudo → perda de rastreabilidade financeira.
  3. 🟠 ACH-PROJ-02 — aprovar aditivo com item sem disciplina falha em silêncio (NULL em coluna NOT NULL no trigger), bloqueando o fluxo com erro genérico.
