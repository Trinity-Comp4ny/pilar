# Spec 025 — Padronização de filtros do sistema

Status: Em implementação (Camada 0)
Depende de: [024 — Filtros do Financeiro padronizados](024-filtros-financeiro-padronizados.md)
ADR: [0014 — Filtros padronizados em componentes compartilhados](../architecture/adr/0014-filtros-padronizados-em-componentes-compartilhados.md)

## Problema

A spec 024 padronizou os filtros do Financeiro em componentes compartilhados. O inventário
do app inteiro mostrou a mesma inconsistência espalhada: 4 implementações independentes de
date-range com preset e um multi-select que não é reusado.

| Onde | Filtro de data hoje | Multi-seleção hoje |
|---|---|---|
| Financeiro | `FiltroPeriodo` (já) | `MultiSelectFilter` (já) |
| **Relatórios** | preset via Select + 2 calendários single (duplica `lib/periodo.ts`) | Select |
| **Projetos** (`ProjetosFilterBar`) | 2 DatePicker De/Até + "Próximos 30d" na mão | checkbox-list própria (reescreve `MultiSelectFilter`) |
| **Timesheet** | 2 DatePicker De/Até | Select |
| **Leads / Meu trabalho** | presets por prazo via Select (lógica solta) | Select / chips |

`MultiSelectFilter` está em `pages/financeiro/components/` — preso ao Financeiro. Não há
`FilterBar` genérico nem saved views (ver ADR 0014: saved views fora de escopo).

## Camadas

### Camada 0 (esta entrega — barata, mata a maior duplicação)

1. **Mover `MultiSelectFilter`** de `pages/financeiro/components/` para
   `src/components/filters/` (vira reuso oficial). Atualizar importadores.
2. **Presets mais ricos em `lib/periodo.ts`**: adicionar `ultimos-7`, `este-trimestre`,
   `trimestre-passado`. Trimestre entra no conjunto padrão do `FiltroPeriodo`.
3. **Relatórios usa `FiltroPeriodo`**: trocar o Select de preset + os dois calendários
   De/Até por um único `FiltroPeriodo`, matando a reimplementação de `lib/periodo.ts`.

### Camada 1 (feita 2026-08-11, com correção de rota)

- **Timesheet período → `FiltroPeriodo`** (feito): a barra do Timesheet é de filtros em
  linha, então o pill-popover encaixa limpo. Ponte string(`yyyy-MM-dd`)↔Date.
- **Projetos: as 3 seções de checkbox (Equipe/Cliente/Disciplina) viram uma só**
  `CheckboxSearchSection` (feito). **Não** viraram `MultiSelectFilter`: o `ProjetosFilterBar`
  já vive dentro de UM popover de "Filtros" com seções inline, e `MultiSelectFilter` é um
  Popover próprio — aninhar seria popover-dentro-de-popover. Deduplicar as 3 seções
  idênticas num componente inline é o ganho real, sem regressão de UX.
- **Projetos período fica como está** (decisão): a `PeriodoSection` é inline no painel e
  carrega um eixo extra (campo de data: Previsão/Início/Conclusão) + "Próximos 30d" que o
  `FiltroPeriodo` (intervalo passado, pill-popover) não modela. Forçar aninharia popover e
  perderia o eixo de campo. Reconciliar os dois paradigmas de filtro (pill-por-filtro vs
  painel-único) é decisão de design maior, não swap mecânico — fica para Camada 2+.

### Camada 2 (depois, com cuidado)

- Unificar os presets "por prazo" de Leads (`prox7/atrasados/mes`) e Meu trabalho
  (`atrasadas/hoje/semana/sem_prazo`). Atenção: é filtro por **vencimento**,
  semanticamente diferente de data de criação — não achatar cego no `FiltroPeriodo` de
  intervalo; provavelmente um preset-set próprio.

## Fora de escopo (ADR 0014)

- Filter-builder estilo ClickUp (campo+operador+valor, aninhado).
- Saved views / persistência de filtro por usuário.
- `FilterBar` genérico (busca+chips+contador) — candidato futuro, não agora.

## Critérios de aceite (Camada 0)

- [ ] `MultiSelectFilter` em `src/components/filters/`; importadores atualizados; typecheck verde.
- [ ] `lib/periodo.ts` com `ultimos-7`/`este-trimestre`/`trimestre-passado` e testes.
- [ ] Relatórios sem preset-Select nem calendários single próprios: um `FiltroPeriodo` só.
- [ ] `npm run typecheck`, `test:run` e lint verdes.
