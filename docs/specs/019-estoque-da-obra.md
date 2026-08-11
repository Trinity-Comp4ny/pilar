# SPEC: Estoque da obra (compra unificada, fase 4)

**Data:** 2026-08-11
**Status:** Draft
**Autor:** Matheus (com painel de agentes 2026-08-11: ICP, Red Team, Produto)
**Módulo:** obras (+ financeiro)

Materializa a **Fase 4 — Compra unificada** do roadmap da
[spec 016](./016-conta-da-obra-e-prestacao-de-contas.md). Cresce sobre a conta da
obra (spec 016) e as [cotações](./018-cotacoes-na-obra.md) (spec 018), respeitando o
guardrail de ERP do [ADR 0013](../architecture/adr/0013-financeiro-de-obra-por-administracao-dois-bolsos-uma-lente.md).
Base competitiva em `research/aec/suprimento-estoque-e-frota-concorrentes.md`.

> **GATE 0 (não codar antes disto).** Esta spec só vira código depois que **conta da
> obra (016) e cotação (018) estiverem em produção e a VRZ operar 1 obra real por ~2
> semanas** (lançando despesas e decidindo ≥1 cotação com despesa lançada). O ciclo de
> suprimento inteiro pendura na conta da obra; construir estoque sobre uma fundação que
> ninguém usou é erguer o segundo andar sem o primeiro. Hoje a cotação está na branch
> `feat/obras-cotacoes` (não mergeada) e a conta da obra ainda é Draft.

## Problema

No modelo por administração, o dono da obra paga o material e cobra transparência:
"comprei 100 sacos de cimento, cadê?". Hoje o Pilar registra a **compra** (despesa na
conta da obra), mas trata toda compra como custo já consumido. Não separa o que foi
**comprado** do que foi **aplicado na obra**, então some do radar o material parado no
canteiro (dinheiro do cliente que ainda não virou obra) e o desperdício (comprou mais do
que a etapa precisava). Quem sente: o sócio do escritório que administra a obra (VRZ,
piloto na obra de Indaiatuba) e o dono da obra, na prestação de contas.

## Objetivo

Depois desta feature: cada obra tem um **estoque de material** derivado das compras que
já acontecem, mostrando por material **comprado − aplicado = saldo**, em quantidade e em
R$, amarrado à etapa (frente). A pergunta "cadê meu material?" passa a ter resposta sem
planilha: "você pagou 100 sacos, 60 viraram obra, 40 estão no canteiro (R$ X parados)".

Métrica de sucesso: numa obra real, a VRZ registra entradas de material a partir das
compras e consegue dizer ao cliente, sem abrir planilha, quanto de cada material foi
comprado, quanto foi aplicado e o saldo no canteiro. **A feature entrega valor mesmo se
a baixa por consumo não for religiosa** (o comprado por etapa já vale sozinho; a baixa é
o plus que o Gate 1 valida antes de investir mais).

**Fora de escopo (cortado, não "depois"):**

- **Composição / coeficiente de consumo (SINAPI/TCPO, "0,5 sc por m²").** Vetado por
  specs 015/016 e ADR 0013. O dado-base não existe (frente é só nome + ordem, sem
  serviço quantificado) e uma previsão errada quebra a própria tagline de margem. O
  material é lançado como quantidade humana, nunca calculado por coeficiente.
- **Previsão no tempo / alerta de lead time ("compre até dia X").** É o pedaço
  defensável de verdade (`data de compra = data necessária − lead time − folga`), mas
  depende de **datas por etapa** no cronograma, que só chegam com a Fase 2 (esqueleto de
  etapas). Vira sua própria spec quando a fase 2 existir.
- **Perfil de campo / app mobile / requisição pelo pedreiro.** A RLS é tenant-level; não
  há noção de "membro da obra X". Um usuário de campo veria margem e todas as obras.
  Restringir de verdade = reescrever RLS por membership (ADR próprio + auditoria). Só
  depois de pagante pedir por escrito. Mobile já está fora do MVP de Obras.
- **Catálogo global de materiais, SKU, curva ABC, custo médio PEPS/UEPS, múltiplos
  depósitos, inventário físico.** Território de ERP; onde o Pilar perde pra Contractor
  Foreman (US$49) e Obra Prima (R$399). Material é por obra, criado inline.
- **Motor de dinheiro novo.** A entrada **não** cria despesa; ela se vincula à despesa
  que a compra/cotação já lança na conta da obra (spec 016/018). Zero digitação dupla.

## Requisitos

Funcionais:

1. Dentro de uma obra, o usuário com permissão de editar obra cadastra **materiais**
   (nome + unidade, categoria opcional), por obra. O material pode ser criado **inline**
   no momento de registrar um movimento (sem tela de cadastro obrigatória, como o
   fornecedor livre na cotação).
2. O usuário registra uma **entrada** (compra recebida) de um material: quantidade, data,
   valor unitário (opcional), frente (opcional) e observação. A entrada pode nascer de:
   (a) a decisão de uma **cotação** com "lançar despesa" (spec 018) oferece registrar
   quanto entrou em estoque, herdando material/qtd/valor/frente da proposta vencedora; ou
   (b) lançamento manual avulso.
3. O usuário registra uma **baixa** (consumo/aplicação) de um material: quantidade, data,
   frente (opcional). A baixa pode ser lançada no **RDO** do dia (campo novo "material
   aplicado") ou avulsa na aba de estoque.
4. A aba mostra, por material, **comprado, aplicado e saldo** (comprado − aplicado) em
   quantidade, e um total de **"material comprado ainda não aplicado"** em R$ (valorizado
   pelo custo médio das entradas do material). Saldo pode ser negativo (baixa maior que
   entrada é permitida e sinalizada, não bloqueada).
5. A entrada vinculada a uma despesa/cotação mostra o elo (de qual compra veio); excluir
   a despesa não apaga o movimento de estoque, só desfaz o vínculo (`SET NULL`).
6. Sem permissão de editar obra, o usuário vê o estoque e os movimentos mas não os botões
   de registrar/editar/excluir.

Não-funcionais:

- **Segurança / RLS:** `obra_material` e `obra_material_mov` com
  `empresa_id = public.get_user_empresa_id()`, INSERT/UPDATE revalidando as FKs
  cross-tenant (`obra_id`, `obra_material_id`, `obra_frente_id`, `obra_conta_lancamento_id`,
  `obra_rdo_id`) com `EXISTS`, no padrão da spec 018. Grants só para `authenticated`,
  nunca `anon`. Soft delete via `deleted_at`.
- **Multi-tenant:** isolamento por `empresa_id`; nenhum movimento cruza empresa nem obra.
- **Performance:** comprado/aplicado/saldo por agregação no banco (sem N+1 no client);
  `staleTime` generoso na aba de estoque.
- **Integridade:** valor parado derivado dos movimentos; sem tabela de saldo materializada
  (evita saldo divergente). Vínculo entrada↔despesa é `SET NULL` (a compra é a fonte do
  dinheiro; o estoque é a lente física).

## Critérios de aceite

- [ ] Dado um material "Cimento CP-II" (un = saco), quando registro entrada de 100,
      então o estoque mostra comprado 100, aplicado 0, saldo 100.
- [ ] Dado saldo 100, quando registro baixa de 60, então saldo 40, e o total "comprado
      não aplicado" reflete 40 × custo médio das entradas.
- [ ] Dado que decido uma cotação de cimento com "lançar despesa", quando marco "entrou
      em estoque", então surge uma entrada de estoque vinculada àquela despesa, com o
      valor e a quantidade da proposta vencedora.
- [ ] Dado que excluo a despesa de origem, então a entrada de estoque permanece com o
      vínculo nulo (saldo não muda por causa da exclusão financeira).
- [ ] Dado um material sem nenhuma baixa (ninguém deu consumo), então o saldo é igual ao
      comprado e a aba ainda é útil (a feature não depende da baixa para valer).
- [ ] Caso de borda: baixa de 120 sobre entrada de 100 é aceita, saldo fica −20 e a
      linha é sinalizada como saldo negativo (não bloqueia).
- [ ] Caso de borda: usuário de outra empresa não vê nem insere movimento (RLS); INSERT
      com `obra_material_id`/`obra_id` de outra empresa é rejeitado.
- [ ] Sem permissão de editar obra, os botões de registrar/editar/excluir não aparecem.
- [ ] `npm run test:run` e `npm run typecheck` verdes; testes do cálculo de saldo e do
      custo médio em `src/lib/obras.ts`.

## Dados e contratos

Tabelas novas (migration + `npm run gen:types`, commitar `types.ts` — staging primeiro,
ADR 0007):

```sql
-- material da obra (catálogo leve por obra, criado inline)
create table public.obra_material (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null,
  unidade text not null,          -- sc, kg, m2, m3, un...
  categoria text,                 -- opcional, agrupador livre
  created_by uuid not null default auth.uid(), updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- movimento: entrada (compra recebida) ou baixa (consumo/aplicação)
create table public.obra_material_mov (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  obra_material_id uuid not null references public.obra_material(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','baixa')),
  quantidade numeric(14,3) not null check (quantidade > 0),
  data date not null,
  obra_frente_id uuid references public.obra_frente(id) on delete set null,
  valor_unitario numeric(14,2) check (valor_unitario is null or valor_unitario >= 0), -- só entrada
  -- elos com o que já existe (nunca origem do dinheiro, só rastro):
  obra_conta_lancamento_id uuid references public.obra_conta_lancamento(id) on delete set null,
  obra_rdo_id uuid references public.obra_rdo(id) on delete set null,
  observacoes text,
  created_by uuid not null default auth.uid(), updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

Cálculo (puro, em `src/lib/obras.ts`, testável como `calcularAvanco`):
`saldoMaterial(movs)` → `{ comprado, aplicado, saldo }` por material; custo médio =
`soma(entrada.qtd × valor_unitario) / soma(entrada.qtd)`; valor parado = `saldo × custoMedio`.

Front: `useObraEstoque(obraId)` devolve materiais com movimentos embutidos (filtrando
soft-deleted que o embed do PostgREST não remove). Nova aba "Estoque" em
`src/pages/obras/[id]/index.tsx` (6ª aba, ao lado de Cotações). Campo "material aplicado"
no `RdoFormDialog` cria movimentos de baixa vinculados ao RDO.

## Plano de implementação

Preenchido/refinado em plan mode e aprovado antes de gerar código. Esboço:

1. Migration: `obra_material`, `obra_material_mov` + RLS (padrão spec 018) + índices +
   triggers de `updated_at` + grants. `gen:types`; commitar `types.ts` (staging, ADR 0007).
2. `src/lib/obras.ts`: `saldoMaterial`, `custoMedioEntradas`, `valorParado` + testes.
3. `src/hooks/useObraEstoque.ts`: query + mutations (salvar/excluir material e movimento).
4. Componentes: `ObraEstoqueTab` (lista por material com comprado/aplicado/saldo),
   `MaterialMovDialog` (entrada/baixa, material inline).
5. Elo com a cotação: no diálogo de decisão da cotação (spec 018), opção "entrou em
   estoque" que cria material (ou reusa) + movimento de entrada vinculado à despesa.
6. Campo "material aplicado" no `RdoFormDialog` (baixa vinculada ao RDO).
7. 6ª aba "Estoque" em `src/pages/obras/[id]/index.tsx`.
8. Testes dos critérios de aceite + QA (com/sem feature `obras`, com/sem permissão, dark).

## Decisões e riscos

- **Decisão:** estoque é uma **lente física sobre a compra que já existe**, não um motor
  novo. Entrada se vincula à despesa (spec 016/018) por `SET NULL`; o dinheiro nunca é
  duplicado. Alinha com "objeto compra" da Fase 4 (roadmap 016).
- **Risco (tela vazia, lição do timesheet, reforçado pelo ICP):** ninguém dá baixa
  detalhada de consumo. **Mitigação de design:** o valor não depende da baixa (comprado
  por etapa já responde a prestação de contas); a baixa entra pelo RDO (onde a pessoa já
  está) e é opcional. **Gate 1:** se em 2 semanas ninguém registrar baixa nem olhar o
  saldo, o estoque está morto e não se avança para as próximas fases.
- **Risco (ERP):** escorregar para almoxarifado (inventário, custo médio complexo,
  depósitos). **Guardrail:** material por obra, custo médio simples, saldo derivado, sem
  SKU/ABC/PEPS. Se cruzar essa linha, perde para ERP mais barato (research citado).
- **Risco (composição sedutora):** pressão para "prever quanto vou precisar". Cortado até
  existir dado de serviço quantificado por frente. Previsão errada = margem errada.
- **Dependência dura:** conta da obra (016) e cotação (018) em produção e em uso (Gate 0).
  Reusa `fornecedores`, `obra_frente`, `obra_conta_lancamento`, `obra_rdo` existentes.
- **Suposição a validar com a VRZ (teste de R$0):** que "comprei × apliquei × saldo por
  etapa" é a dor da prestação de contas de material. Pedir por escrito antes de ampliar.

## Sequência depois desta spec (gates)

- **Gate 1 → Requisição de campo (web, sem role novo):** a VRZ registra entrada e baixa
  ≥1×/semana por 2 semanas e olha o saldo. Só então vale a lista "o que está faltando"
  que alimenta uma cotação.
- **Gate 2 → Perfil de campo + mobile (foto):** a VRZ ou o cliente pede por escrito
  acesso de campo para quem não é gestor. Exige ADR de RLS por membership + auditoria.
- **Aresta de lead time:** só quando a Fase 2 (esqueleto de etapas com datas) existir.
