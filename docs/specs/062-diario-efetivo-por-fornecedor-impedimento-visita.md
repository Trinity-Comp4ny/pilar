# SPEC: Diário de obra — efetivo por fornecedor, impedimento e visita

**Data:** 2026-08-26
**Status:** Draft
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [015 — Obras MVP](015-obras-mvp.md), [040 — Obra inteligente](040-obra-inteligente-cronograma-diario-clima.md), [042 — Pilar Campo](042-pilar-campo-app-de-campo.md)

<!-- Origem: docs/strategy/DECISOES.md, entrada 2026-08-25 (módulo Obras é a
frente prioritária). Escopo fechado em 2026-08-26 depois de reler 015/018/040/042
e o código real do RdoFormDialog: o "diário estruturado" que uma auditoria
competitiva sugeria já está entregue (spec 040, cronograma⇄diário + alerta de
clima) ou em produção via Pilar Campo (spec 042, offline + foto). Esta spec cobre
só o que sobrou de genuinamente ausente, confirmado linha a linha no código. -->

## Problema

O diário de obra (`obra_rdo`) já reporta contra o cronograma, alerta de clima e
funciona offline pelo Pilar Campo. Mas três informações que o dia de obra real
carrega ainda não têm lugar estruturado:

1. **Efetivo** é um número solto (`obra_rdo.efetivo int`) — não diz _de quem_.
   Numa obra por administração com 3 empreiteiras no canteiro, "12 pessoas hoje"
   não deixa saber se a empreiteira elétrica sumiu ou se todo mundo apareceu.
2. **Impedimento** (algo que travou o serviço: falta de material, chuva que
   parou concretagem, pendência de projeto) hoje se mistura em "Ocorrências", uma
   textarea livre igual a qualquer observação — não dá pra listar "o que está
   travando esta obra agora" sem reler texto solto de vários dias.
3. **Visita** (arquiteto, cliente, fiscal, engenheiro terceiro) não tem registro
   nenhum hoje; quando acontece, vira nota dentro de "Atividades do dia" ou nem é
   lançada — o dia some do "quem esteve na obra".

## Objetivo

O diário passa a ter três estruturas pequenas, todas no mesmo formulário do dia
(sem etapa nova de wizard): efetivo por fornecedor (com contagem), impedimento
como registro tipado e destacado, e visita ligada ao cadastro de fornecedor.
Depois desta feature, abrir uma obra responde de bate-pronto "quem estava lá",
"o que está travando" e "quem visitou", sem reler texto livre.

**Fora de escopo:**

- Reabrir o modelo de "Partes" com múltiplos papéis (cliente/fornecedor/
  arquiteto na mesma ficha) mapeado no Mapa de Melhorias como LOG-6. Visita e
  efetivo aqui referenciam **`fornecedores`** (cadastro existente), não uma
  entidade nova. Se o cliente final ou um profissional sem CNPJ precisar
  aparecer como visitante, entra como texto livre num campo `nome_livre`
  (mesmo padrão de `obra_cotacao_proposta.fornecedor_nome`, spec 018).
  Fica marcado que LOG-6 melhoraria isso, não se resolve aqui.
- Fila de aprovação de impedimento ou fluxo de escalonamento. Impedimento aqui é
  **registro**, não workflow (sem status próprio, sem SLA). Se um impedimento
  virar bloqueio sério, o time trata fora do Pilar por ora.
- Alterar `obra_rdo.efetivo` (o número agregado continua existindo, calculado
  como a soma do efetivo por fornecedor quando houver algum lançado, ou editável
  à mão quando não houver — não quebra o dado histórico já lançado).
- **Foto no impedimento (revisado no plano, 26/08).** O pipeline de foto atual
  (`_campo_registrar_foto`) só sabe anexar à `rdo_id`, que já existe no momento
  do upload. Um impedimento criado na mesma sessão offline só ganha `id` real
  depois de sincronizar — anexar foto exigiria uma segunda etapa de resolução
  de dependência (sincroniza impedimento → guarda o id real → só então sobe a
  foto), que a fila atual não tem para nenhum registro filho hoje (nem
  medição, nem tarefa). Implementar isso direito é a própria spec seguinte, não
  um adendo de uma tarde. Aqui o impedimento é descrição + tipo, sem foto; a
  foto do dia (já suportada) continua servindo como evidência geral do RDO.
- Mudar o Pilar Campo (spec 042) além do formulário do dia: os três campos
  novos entram no componente `CampoRegistrarDia.tsx` que já existe, seguindo
  exatamente o padrão "registrar item a item" que `medição` já usa
  (`campo_registrar_medicao`), não o padrão "substituir o conjunto" que
  `obra_rdo_tarefa` usa no escritório (motivo: a fila offline reenviar o mesmo
  item duas vezes é seguro em registro append-only; um "substituir tudo" pelo
  campo arriscaria apagar lançamento de outro dispositivo).

## Requisitos

Funcionais:

1. No formulário do dia, o usuário pode lançar **efetivo por fornecedor**: para
   cada linha, escolhe um fornecedor do cadastro (ou digita um nome livre, se o
   prestador não estiver cadastrado) e informa a quantidade de pessoas. Pode
   lançar quantas linhas quiser (mín. 0). O campo `efetivo` (total) do RDO passa
   a ser **derivado** (soma das linhas) quando houver ao menos uma linha
   lançada; sem nenhuma linha, continua editável como número solto (não quebra
   o comportamento atual nem o histórico).
2. O usuário pode registrar um ou mais **impedimentos** do dia: descrição
   (obrigatória) e tipo (`falta_material`, `clima`, `pendencia_projeto`,
   `mao_de_obra`, `outro`). Um impedimento pertence a um dia (`rdo_id`), nunca
   solto. Sem foto neste MVP (ver "Fora de escopo").
3. Impedimentos do dia aparecem **destacados** no card do dia no Diário (cor de
   alerta, ícone), separados da textarea "Ocorrências" (que continua existindo
   para nota livre solta que não é impedimento).
4. O usuário pode registrar uma ou mais **visitas** do dia: fornecedor visitante
   (do cadastro, com CNPJ visível na lista pra diferenciar homônimos) ou nome
   livre, e uma observação curta opcional (o motivo da visita). Uma visita
   pertence a um dia (`rdo_id`).
5. O card do dia no Diário lista, quando existirem: as linhas de efetivo por
   fornecedor, os impedimentos (destacados) e as visitas — cada bloco só
   aparece se tiver algo lançado (sem bloco vazio poluindo o card).
6. Tudo isto funciona **offline no Pilar Campo** igual ao resto do formulário do
   dia: lançamentos ficam na fila local e sincronizam quando a rede volta,
   incluindo a foto do impedimento.

Não-funcionais:

- **Segurança / RLS:** três tabelas novas (`obra_rdo_efetivo`,
  `obra_rdo_impedimento`, `obra_rdo_visita`), todas com `empresa_id` e o mesmo
  padrão de `obra_rdo_tarefa` (spec 040): policy por
  `empresa_id = get_user_empresa_id()`, revalidando `rdo_id` e (quando houver)
  `fornecedor_id` com `EXISTS` da mesma empresa. Escrita pela sessão de campo
  (spec 042) revalida também o `obra_id` do token, no padrão das policies de
  escrita já existentes para `obra_rdo`/`obra_rdo_foto` via `campo_accounts`.
- **Multi-tenant:** isolamento por `empresa_id`; nenhuma linha nova cruza
  empresa (fornecedor de outra empresa é rejeitado no INSERT).
- **Performance:** as três tabelas são pequenas e lidas por `rdo_id` (índice),
  sem full-scan; a lista de fornecedores do combobox usa a query já existente
  (`useFornecedores` ou equivalente), sem N+1.
- **Compatibilidade:** RDOs já lançados sem nenhuma linha nova continuam
  válidos e exibindo exatamente como hoje (nenhum bloco novo aparece).

## Critérios de aceite

- [ ] Dado um RDO sem nenhuma linha de efetivo por fornecedor, quando edito o
      campo "Efetivo (total)" à mão, então salva como hoje (comportamento
      preservado).
- [ ] Dado que lanço 2 linhas de efetivo (Empreiteira A: 5, Empreiteira B: 3),
      quando salvo o dia, então o total do RDO mostra 8 e o card do dia lista as
      2 linhas com o nome de cada fornecedor.
- [ ] Dado que registro um impedimento "Falta de cimento" tipo `falta_material`,
      quando salvo, então ele aparece destacado no card do dia, distinto da
      textarea de Ocorrências.
- [ ] Dado que registro uma visita do fornecedor "Estrutural XYZ Ltda" com
      observação "vistoria de fundação", quando salvo, então ela aparece no
      card do dia com o nome do fornecedor.
- [ ] Dado um fornecedor não cadastrado, quando lanço efetivo ou visita com nome
      livre, então o lançamento salva normalmente e exibe o nome digitado.
- [ ] Caso de borda: usuário do Pilar Campo sem rede lança 1 linha de efetivo, 1
      impedimento e 1 visita; quando a rede volta, então os três sincronizam e
      aparecem no diário do escritório.
- [ ] Caso de borda: o mesmo item da fila offline é reenviado duas vezes (retry
      após falha parcial); então não duplica (register-one é idempotente o
      bastante para o caso real: pior cenário é um lançamento duplicado visível
      e removível à mão, nunca perda de dado).
- [ ] Caso de borda: `fornecedor_id` de outra empresa é rejeitado pela RLS no
      INSERT de qualquer uma das 3 tabelas novas.
- [ ] Multi-tenant: sessão de campo da obra X não grava efetivo/impedimento/
      visita em RDO da obra Y.
- [ ] `npm run test:run` e `npm run typecheck` verdes.

## Dados e contratos

Três tabelas novas (migration única, padrão de `obra_rdo_tarefa` da spec 040):

```sql
-- obra_rdo_efetivo: quantas pessoas de cada fornecedor estiveram na obra no dia
CREATE TABLE public.obra_rdo_efetivo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id         uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  fornecedor_id  uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome text,  -- usado quando fornecedor_id é nulo (prestador não cadastrado)
  quantidade     int NOT NULL CHECK (quantidade > 0),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (fornecedor_id IS NOT NULL OR fornecedor_nome IS NOT NULL)
);

-- obra_rdo_impedimento: o que travou o serviço no dia, com destaque (sem foto no MVP)
CREATE TABLE public.obra_rdo_impedimento (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id      uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  descricao   text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN
    ('falta_material','clima','pendencia_projeto','mao_de_obra','outro')),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- obra_rdo_visita: quem visitou a obra no dia
CREATE TABLE public.obra_rdo_visita (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  rdo_id         uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  fornecedor_id  uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome text,
  observacao     text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (fornecedor_id IS NOT NULL OR fornecedor_nome IS NOT NULL)
);
```

RLS nas três tabelas, padrão de `obra_rdo_tarefa` (spec 040): SELECT/INSERT/
UPDATE/DELETE por `empresa_id = get_user_empresa_id()`, com `EXISTS` revalidando
`rdo_id` (mesma empresa) e `fornecedor_id` (quando não nulo, mesma empresa) no
INSERT. Esta é a via de escrita do **escritório** (usuário autenticado, direto
pelo cliente Supabase).

**Escrita do Pilar Campo** não passa pelo RLS acima (a conta de campo não tem
`auth.uid()`, igual a `obra_rdo`/`obra_rdo_medicao`): três RPCs
`SECURITY DEFINER` novas, no padrão exato de `campo_registrar_medicao`
(20260833000000_campo_medicao.sql) — token → `campo_accounts` → valida
`obra_id`/`rdo_id` → insere uma linha:

```sql
campo_registrar_efetivo(p_token text, p_rdo_id uuid, p_fornecedor_id uuid, p_fornecedor_nome text, p_quantidade int) RETURNS json
campo_registrar_impedimento(p_token text, p_rdo_id uuid, p_descricao text, p_tipo text) RETURNS json
campo_registrar_visita(p_token text, p_rdo_id uuid, p_fornecedor_id uuid, p_fornecedor_nome text, p_observacao text) RETURNS json
```

Cada uma revalida, quando `p_fornecedor_id` não é nulo, que o fornecedor é da
`empresa_id` da sessão (`EXISTS` contra `fornecedores`). `campo_listar_rdos`
ganha as três listas agregadas por dia (mesmo padrão de `fotos`/`medicoes`
já devolvidos hoje).

Isto muda o schema → `npm run gen:types` depois de aplicar no staging, commitar
`types.ts` (o gate `types-sync` bloqueia se esquecer, ADR do CI).

Front do escritório consome via três hooks novos (`useObraRdoEfetivo`,
`useObraRdoImpedimentos`, `useObraRdoVisitas`), seguindo o padrão de
`useObraRdoTarefas` (spec 040): leem por `rdoId`/`obraId`, mutation de
**substituir o conjunto do dia** (delete + insert), `onSuccess` invalida a
query. Front do Pilar Campo chama as RPCs uma linha por vez (padrão de
`campo_registrar_medicao`), com os itens novos entrando na fila offline
(`campoOfflineQueue.ts`) do mesmo jeito que `FilaMedicao`/`FilaTarefaVinculo`
já entram hoje.

## Plano de implementação

Refinado em 26/08 depois de ler o código real (`RdoFormDialog.tsx`,
`useObraRdoTarefas.ts`, `CampoRegistrarDia.tsx`, `campoOfflineQueue.ts`,
`20260833000000_campo_medicao.sql`, `useFornecedorDetalhe.ts`). Passos
ordenados e verificáveis:

1. **Migration** `supabase/migrations/20260860000000_diario_efetivo_impedimento_visita.sql`
   (continua a sequência numérica já usada pelas migrations de Obras/Campo):
   3 tabelas + RLS de escritório (padrão `obra_rdo_tarefa`) + 3 RPCs de campo
   (padrão `campo_registrar_medicao`) + `campo_listar_rdos` estendida com as
   3 listas novas. Aplicar local (`supabase migration up`, automático no
   `npm run dev`), depois `npm run gen:types:local`.
2. **`useFornecedoresLite`** (`src/hooks/useFornecedorDetalhe.ts`): incluir
   `cnpj` no select (mudança aditiva, não quebra os consumidores atuais que só
   usam `id`/`nome`).
3. **Três hooks novos** em `src/hooks/useObraRdoSatelites.ts` (ou um arquivo por
   hook, decidir na hora olhando o tamanho): `useObraRdoEfetivo`,
   `useObraRdoImpedimentos`, `useObraRdoVisitas`, cada um com `useQuery` (join
   com `obra_rdo!inner(obra_id)` igual a `useObraRdoTarefas`) e uma mutation
   `useSaveRdoEfetivo`/`useSaveRdoImpedimentos`/`useSaveRdoVisitas` que
   substitui o conjunto do dia (delete + insert, como `useSaveRdoTarefas`).
4. **`RdoFormDialog.tsx`** (escritório): três blocos novos entre "Tarefas do
   cronograma" e "Observações do dia", no mesmo padrão visual de linha
   adicionável. `efetivo` (total) vira somatório das linhas quando houver
   alguma, e mantém o input solto quando não houver nenhuma (checar no
   `onSubmit`: se `efetivoLinhas.length > 0`, sobrescrever `d.efetivo` pela
   soma antes de montar o payload do RDO).
5. **`ObraDiarioTab.tsx`** (escritório): três blocos condicionais no card do
   dia, impedimento com `bg-warning-soft`/ícone de alerta (token semântico,
   nunca cor crua).
6. **`CampoRegistrarDia.tsx`** + **`campoOfflineQueue.ts`** (Pilar Campo):
   estender `FilaDiaItem` com `efetivos: FilaEfetivo[]`, `impedimentos:
FilaImpedimento[]`, `visitas: FilaVisita[]` (mesma forma de `FilaMedicao`:
   payload + `enviada: boolean`); UI mobile com os três blocos (reaproveitando
   o padrão de "+ item" que a etapa de medição já usa); sincronização chama
   as 3 RPCs novas uma linha por vez, marcando `enviada` por item (mesmo loop
   que já existe para fotos/medições/tarefas).
7. **Edge function `campo-upload-foto`**: nenhuma mudança (impedimento não leva
   foto neste MVP).
8. **Testes**: unit do hook de soma de efetivo (função pura, extrair para
   `src/lib/obras.ts` como `somaEfetivo(linhas)` e testar isolado); teste de
   RLS/RPC (INSERT cross-tenant rejeitado) se o padrão de teste de RLS do
   projeto cobrir isso hoje (checar `supabase/migrations/*.test.*` ou
   equivalente antes de inventar um mecanismo novo); `npm run typecheck` e
   `npm run test:run` verdes antes de commitar.
9. **`npm run gen:types:local`** final depois de qualquer ajuste de schema no
   meio do caminho, e commit do `types.ts` junto.

## Decisões e riscos

- **Decisão:** efetivo, impedimento e visita referenciam `fornecedores`
  (cadastro existente), não uma entidade "Partes" nova. Mais rápido de entregar;
  se `fornecedores` continuar raso (Mapa de Melhorias, item LOG-2: só 5 campos,
  sem endereço/dado bancário), essa limitação já está mapeada e não bloqueia
  esta spec — o combobox só precisa de nome e CNPJ.
- **Decisão:** impedimento é registro simples, sem workflow. Se a demanda real
  pedir fila/SLA de impedimento, isso é extensão futura, não redesenho.
- **Risco:** se o ICP/design partner não usar o combobox de fornecedor (prestador
  não cadastrado é a maioria dos casos numa obra pequena), o campo `*_nome`
  livre absorve o uso real sem travar a feature — mesma decisão que a spec 018
  já tomou para propostas de cotação.
- **Confirmado no plano (26/08):** o Pilar Campo é de fato um componente
  separado (`CampoRegistrarDia.tsx`, não reusa `RdoFormDialog`), com sua
  própria fila offline baseada em RPCs "registrar um item por vez"
  (`campo_registrar_medicao` é o precedente exato). Os três campos novos
  seguem esse padrão no campo e o de "substituir o conjunto" no escritório —
  são modelos de escrita diferentes de propósito (ver "Fora de escopo"), não
  inconsistência.
- **Decisão (26/08):** foto no impedimento sai do MVP. O pipeline de foto atual
  só resolve a dependência rdo→foto (o rdo já tem id real antes de subir
  qualquer foto); impedimento criado offline só ganha id real depois de
  sincronizar, e nenhum registro filho hoje (medição, tarefa) tem esse segundo
  nível de espera. Fazer direito é spec própria; forçar agora seria a raiz de
  um bug de sincronização.
- Nenhuma decisão de arquitetura transversal aqui (extensão de padrão já
  existente); não abre ADR novo.
