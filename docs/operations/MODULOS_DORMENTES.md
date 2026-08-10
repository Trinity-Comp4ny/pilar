# Módulos dormentes — inventário e estado real

← [voltar ao índice](./README.md) · Atualizado: 2026-07-27

Decisão que originou este doc: `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md`
("desligar dormentes, flag off nunca delete"). Este arquivo é o mapa de **onde cada
dormente ainda está exposto**, em 4 camadas: menu, rota, feature flag e banco.

## Por que 4 camadas

Esconder do menu NÃO esconde o módulo: a rota continua acessível por URL se a
feature estiver ligada para a empresa. Só o estado no banco decide o que o cliente
alcança.

| Camada   | Onde                                    | Efeito de "esconder" aqui                            |
| -------- | --------------------------------------- | ---------------------------------------------------- |
| Menu     | `src/lib/modules.ts`                    | Some da sidebar; URL direta continua funcionando     |
| Rota     | `src/App.tsx` (`FeatureRoute`)          | Bloqueia se a feature estiver desligada              |
| Catálogo | `src/lib/features.ts` (`dormant: true`) | No admin, feature não pode ser LIGADA (só desligada) |
| Banco    | `empresas.features` (jsonb)             | **A verdade**: define o que cada cliente acessa hoje |

## Estado por módulo (2026-07-27)

| Módulo     | Menu      | Rota               | `dormant` | Ligado em produção     |
| ---------- | --------- | ------------------ | --------- | ---------------------- |
| Timesheet  | oculto ✅ | `/timesheet` viva  | sim       | **5 de 5 empresas** ⚠️ |
| Metas      | oculto ✅ | via financeiro     | sim       | **5 de 5 empresas** ⚠️ |
| Capacidade | oculto ✅ | `/capacidade` viva | sim       | 1 (MF Construção) ⚠️   |
| Templates  | oculto ✅ | `/templates` viva  | sim       | 1 (MF Construção) ⚠️   |
| IA Hub     | oculto ✅ | `/ai` viva         | sim       | 1 (MF Construção) ⚠️   |

Consulta que gerou a tabela (read-only, roda em qualquer ambiente):

```sql
select nome,
  (features ? 'timesheet') as timesheet,
  (features ? 'capacidade') as capacidade,
  (features ? 'templates') as templates,
  (features ? 'ai_hub') as ai_hub,
  (features ? 'metas') as metas,
  (select count(*) from jsonb_object_keys(features)) as total
from empresas order by created_at;
```

**Risco aberto:** IA Hub ligado para um cliente real expõe as 10 edge functions
`ai-*` quebradas (ver `docs/strategy/DECISAO_IA_FEATURES_AGENTES_2026-07-20.md`).
Timesheet ligado expõe um módulo que, pela pesquisa com o ICP, morre em duas
semanas de uso e não tem dono.

## Código órfão (existe, ninguém renderiza)

6 tabs do Financeiro com **zero imports**, somando **~1.750 linhas** e gerando
**61 warnings do ADR 0008** que inflam o backlog de lint sem nenhum benefício:

| Arquivo                                            | Warnings ADR |
| -------------------------------------------------- | ------------ |
| `src/pages/financeiro/tabs/Rentabilidade.tsx`      | 16           |
| `src/pages/financeiro/tabs/ProjecaoFluxoCaixa.tsx` | 12           |
| `src/pages/financeiro/tabs/ResumoMensal.tsx`       | 11           |
| `src/pages/financeiro/tabs/WIP.tsx`                | 10           |
| `src/pages/financeiro/tabs/DRE.tsx`                | 6            |
| `src/pages/financeiro/tabs/AgingRecebiveis.tsx`    | 6            |

Decisão vigente é **não deletar** (a lógica financeira desses arquivos é referência
para quando Rentabilidade voltar como número no detalhe do projeto). Consequência
aceita: esses 61 warnings ficam no backlog e **não devem ser contados** como dívida
das telas vivas ao medir progresso da spec 003.

Não deletar também (memória `feedback_keep_dormant_functions`): as 10 edge functions
`ai-*`, as `ultra-admin-*`, as migrations `agent_write_*` e o backend Asaas.

## Como reativar um dormente (checklist)

1. Existe dono e critério de sucesso? Se não, não reativa.
2. Tirar `dormant: true` do catálogo (`src/lib/features.ts`).
3. Reintroduzir no `src/lib/modules.ts`, no módulo certo (Gestão/Projetos/Obras).
4. Ligar a feature para a empresa piloto (admin, não SQL solto).
5. Pagar a dívida de ADR 0008 do arquivo antes de reexpor a tela.
