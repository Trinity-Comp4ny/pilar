# Backlog do Pilar

← [voltar ao índice](./README.md) · **Última revisão: 2026-08-13**

Índice único do que falta fazer. Cada item aponta para o doc que tem o detalhe;
aqui fica só o quê, o porquê em uma linha e o estado. **Não duplicar conteúdo:**
se um item cresce, ele vira spec/ADR e esta linha passa a linkar para lá.

Ordem das seções = ordem de prioridade. Dentro da seção, do mais crítico ao menos.

---

## 1. Bugs e riscos em produção

| #   | Item                                                                                                                                                                        | Onde                                                       | Detalhe                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| B1  | `saveCoords` atualiza por `codigo_projeto` **sem filtrar `empresa_id`**: dois projetos de empresas diferentes com o mesmo código = escrita cruzada entre tenants            | `src/pages/projetos/components/useProjetoForm.ts:717`      | [decisão 25/07](./strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md) |
| B2  | RPCs de rentabilidade consultam a tabela `timesheets`, que **não existe** (a real é `timesheet_lancamentos`) → erro em runtime, não número errado                           | `rpc_dashboard_rentabilidade`, `rpc_projeto_rentabilidade` | [spec 004](./specs/004-margem-confiavel.md)                         |
| B3  | Folha de pagamento quebra ao abrir (visto na demo de 24/07); módulo ativo que a VRZ usa                                                                                     | `src/pages/financeiro/tabs/folha-pagamento/`               | [decisão 25/07](./strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md) |
| B4  | Cadastro de projeto quebra quando o lookup de CEP falha, e o mapa fica vazio sem explicação                                                                                 | `useProjetoForm.ts:188`                                    | idem                                                                |
| B5  | Campo de parcelamento da receita não é encontrável (o próprio autor não achou na demo)                                                                                      | `src/pages/financeiro/`                                    | idem                                                                |
| B6  | Suíte pgTAP desalinhada das migrations: `audit_logs.new_data` não existe e 10 asserts de `rls_security.sql` falham → o gate `Migrations + RLS + types` **falha em todo PR** | `supabase/tests/`                                          | [plano de engenharia](./operations/PLANO_ENGENHARIA_2026-07.md)     |
| B7  | Preços antigos (R$97/197/397) ainda servidos ao lado do R$690 decidido, ancorando o valor para baixo                                                                        | banco + `src/lib/features.ts:207`                          | [PRICING](./strategy/PRICING.md)                                    |

## 2. Produto: sequência de 90 dias

Gates encadeados: cada item só abre quando o anterior fecha.
Fonte: [decisão 25/07](./strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md).

| #   | Item                                                                                                         | Estado                                               |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| P1  | **Margem confiável** (custo por alocação + declarar confiança do número)                                     | spec escrita: [004](./specs/004-margem-confiavel.md) |
| P2  | **Captura de horas em 30s/dia + view "Meu trabalho"** (o destravador de 14/07; critério do ICP: um gesto só) | não começado                                         |
| P3  | **Proposta de R$690 para a VRZ** (sem código; o teste que ninguém fez ainda)                                 | não começado                                         |
| P4  | **Export xlsx + memorial via docxtemplater** (pedido direto do ICP; hoje só PDF)                             | não começado                                         |
| P5  | **Radar de Prontidão v0**: dependência entre etapas com lead time sobre Fluxos+Gantt+Fornecedores            | não começado                                         |

## 3. Design system (spec 003)

Ondas 1 e 2 entregues; o que falta:

- `KPICard` do Dashboard segue `@deprecated`: migrar exige mapear `cardBg`→tone, **muda cor na tela mais usada** e pede QA visual
- `ContentCard` (wrapper padrão de lista/tabela) não criado
- Lint ADR 0008 ainda em **warning**; backlog de 1242 (dos quais 61 são das 6 tabs órfãs, [ver dormentes](./operations/MODULOS_DORMENTES.md))
- Adoção incremental: `Spinner` (155 ad-hoc), `StatusBadge` em código novo, `EmptyState` (~80 "Nenhum..." soltos), 17 AlertDialogs crus restantes

Detalhe: [spec 003](./specs/003-design-system.md) · [ADR 0008](./architecture/adr/0008-design-system-fonte-unica.md) · [catálogo](./design/CATALOGO_UI.md)

## 4. Agentes (MVP2)

Gate de entrada declarado: **margem reconhecida como verdadeira** ("primeiro o dado, depois o palco").

- **Fase 1 (6-8 dias):** split mecânico de `ai-chat/index.ts` (55K), abrir o stream no topo do pipeline, eventos `run`/`step`, `<AgentExecutionTimeline />` no chat, timeout por inatividade em `useChat.ts:213`
- **Fase 2:** `steps jsonb` em `agent_runs`, aplicar `jobs_queue` (migration `20260715000010` **nunca aplicada em banco nenhum**), consumer via Cron, polling estilo plg-api
- **Pré-requisito:** `ai_usage_logs` tem 0 linhas em produção (COGS invisível); ligar antes de execução multi-step

Detalhe: [decisão 25/07, tese B](./strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md)

## 5. Limpeza (pausada por decisão do CEO em 27/07)

- Desligar features dormentes no banco: **timesheet e metas ligados nas 5 empresas reais**; **IA Hub ligado na MF Construção**, expondo as 10 funções `ai-*` quebradas a um cliente
- SQL com snapshot de rollback pronto; inventário e query de auditoria em [MODULOS_DORMENTES](./operations/MODULOS_DORMENTES.md)

## 6. Engavetado com gatilho (não é dívida)

| Item                                                                                                                                                                                                                                                                                                  | Gatilho para reabrir                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Multi-moeda / Angola                                                                                                                                                                                                                                                                                  | Contrato **pago** não-BRL (hoje sem trilho de cobrança: Stripe não atende Angola) |
| ~~Pilar Obras completo (estoque, clima, PWA de campo)~~ **REABERTO 30/07** (gatilho fechou: VRZ, obra própria) → [spec 015](./specs/015-obras-mvp.md) MVP web-first + [ADR 0011](./architecture/adr/0011-reabrir-obras-como-fase-de-execucao-do-projeto.md). Estoque/PWA/clima-API seguem fora do MVP | —                                                                                 |
| Pilar Gestão como produto (iniciativas, departamentos, carga). Primeiro sinal de demanda real: cliente MF Construções pediu isso especificamente em 17/08, ver [spec 046](./specs/046-objetivos-organizacionais-com-dependencias.md) (Draft, análise de viabilidade)                                  | Só a view "Meu trabalho" está aprovada (= P2); gatilho de reabertura em avaliação |
| Central de documentos (versionamento, TUS, StorageProvider)                                                                                                                                                                                                                                           | Pagante pedindo + Supabase Pro assinado                                           |
| Agentes proativos / Caixa de Decisões                                                                                                                                                                                                                                                                 | Gate de margem fechado                                                            |
| Anunciar os 3 produtos publicamente                                                                                                                                                                                                                                                                   | Produto 2 existir + 1 cliente pagando por ele                                     |

## 7. Obra: frentes de evolução (ideias, não priorizadas)

Registradas em 2026-08-13. Todas estendem o módulo Obras ([spec 015](./specs/015-obras-mvp.md),
[spec 027](./specs/027-cronograma-obra-dois-niveis.md)). Não priorizadas ainda; guardadas
para decidir sequência depois. Não virar ERP, requisição ≠ controle de estoque.

| #   | Item                                                                                                                                          | Esforço | Onde está / conecta                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------- |
| O1  | **Medição / avanço físico das frentes** ◆ North Star: % concluído por frente ligado ao dinheiro liberado; conecta o Diário à Conta da obra    | M       | Frentes e Timeline vivos; falta o eixo de medição  |
| O2  | **Planejamento de gasto por frente** (meta de custo por frente da obra), par natural do avanço físico (O1: planejado vs realizado por frente) | M       | Deriva de O1 + Conta da obra                       |
| O3  | **Requisição de material (leve)**: campo pede insumo ao escritório; requisição, não controle de estoque                                       | M       | Não existe; conecta a Fornecedores e Conta da obra |
| O4  | **Checklist de qualidade / inspeção**: conferência por etapa, aprovado/reprovado + responsável                                                | M       | Não existe                                         |

## 8. Pendências operacionais

- **Commit em branch errada:** `origin/feat/enable-e2e-in-ci` contém `068503e` (design system), que não pertence a ela. Se virar PR, leva UI junto. Corrigir com reset para `a3b14b4` ou rebase — reescreve branch, exige decisão do CEO
- **Sessões paralelas no mesmo working tree** misturaram commits em 27/07: usar `git worktree` para trabalho simultâneo ([armadilhas de toolchain](../CLAUDE.md) e memória do projeto)
- **QA visual pendente** do shell (spec 001) e do header (spec 002): mergearam sem walkthrough do CEO
