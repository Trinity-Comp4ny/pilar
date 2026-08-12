# SPEC: Obra no portal do cliente (acompanhamento + prestação de contas)

**Data:** 2026-08-12
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** portal · obras
**Depende de:** [015 — Obras MVP](015-obras-mvp.md), [016 — Conta da obra e prestação de contas](016-conta-da-obra-e-prestacao-de-contas.md), [020](020-cronograma-da-obra.md)/[027 — Cronograma da obra](027-cronograma-obra-dois-niveis.md)

## Problema

O escritório de engenharia que **administra** a obra do cliente por taxa (regime
cost-plus, 8-15%) usa dinheiro do cliente e precisa prestar contas: onde cada
centavo foi, com a nota atrás. Hoje o sócio faz isso no braço, Excel + reunião
presencial + pilha de notas escaneadas todo fim de mês. É o gargalo que consome o
sábado dele e a peça que sustenta a taxa (cliente que enxerga cada centavo renova
e indica). O portal do cliente já existe, mas só mostra projetos, entregas e
faturas; a obra e sua conta ficam de fora.

O dono da obra, do outro lado, liga toda semana perguntando "como está lá?" e
"quanto já gastei do que coloquei?". Metade dessas ligações é falta de uma tela
onde ele mesmo veja o avanço e o saldo.

## Objetivo

O dono da obra passa a acompanhar, no portal que já usa, o **cronograma** (avanço
por frente/passo, com foto) e a **prestação de contas** da obra que o escritório
administra: quanto aportou, o que já saiu, cada despesa com a nota, o saldo, e a
taxa de administração como uma linha limpa. Depois desta feature o sócio publica a
conta da obra em vez de montar planilha, e a reunião mensal vira revisão do que o
dono já viu.

**Fora de escopo (corta discussão depois):**

- **App de campo / captura por operário.** Nenhuma escrita pelo dono ou por
  terceiro no portal. Portal-obra é **read-only** para o cliente. A captura de
  campo (foto de nota, foto de avanço) é feita pela equipe no app interno, e é a
  spec/fase seguinte, não esta.
- **Obra em `preco_fechado`.** O portal-obra financeiro só existe para
  `modelo_cobranca = 'administracao'`. Em preço fechado o custo real é a margem do
  escritório e não pode aparecer.
- **Cotações / comparativo de fornecedores no portal.** O cliente nunca vê a
  negociação (propostas, preços de N fornecedores, quem perdeu). Vê só a **despesa
  decidida**, com a nota.
- **Curva-S / físico-financeiro, EVM, aprovação de despesa pelo cliente,
  pagamento de despesa da obra via Asaas dentro do portal.** Ficam para depois.
- **Estoque, RDO cru, clima** expostos ao cliente. O cliente vê avanço e conta, não
  o diário operacional inteiro.

## Requisitos

Requisitos funcionais, numerados, testáveis:

1. Uma obra aparece no portal de um cliente somente quando: (a) tem
   `cliente_id` correspondente ao cliente logado **e** (b) `modelo_cobranca =
'administracao'`. Obra sem `cliente_id` ou em `preco_fechado` **não aparece**.
2. O cliente vê, por obra liberada, uma tela com duas seções: **Cronograma**
   (frentes/passos com estado e % de avanço, reusando a lógica de `obras.ts`) e
   **Prestação de contas**.
3. A prestação de contas mostra: total aportado, total gasto, saldo, e a **lista de
   despesas** — cada uma com data, descrição, valor, frente, e o **link do
   comprovante** quando houver. Mostra a **taxa de administração** como linha
   própria ("administração X% = R$ Y").
4. O cliente vê **somente despesas confirmadas**. Uma despesa marcada como rascunho
   / em conferência pela equipe **não aparece** no portal. (Ao vivo do confirmado,
   não fechamento mensal — decisão do CEO; ver Riscos.)
5. O cliente **não vê** cotações, propostas de fornecedores, comparativo, nem
   despesa em `preco_fechado` (por construção do requisito 1).
6. A equipe libera/oculta a obra do portal a partir da tela interna da obra
   (um toggle "visível no portal" por obra), independente por obra.
7. Foto de avanço e comprovante de nota entram por **link** (Drive), coerente com
   a decisão anexo-por-link ([[project_anexos_por_link_2026-07-30]]). Foto de
   avanço pertence ao cronograma; comprovante pertence à despesa. **Nunca no mesmo
   álbum** (evita o cliente ver nota que não devia).

Requisitos não-funcionais:

- **Segurança / tenancy:** todo dado do portal-obra passa por RPC nova
  `SECURITY DEFINER` que recebe o token de sessão, valida via
  `portal_verify_session_readonly`, e escopa por `cliente_id` **e** `empresa_id`
  derivados do token. O filtro `modelo_cobranca = 'administracao'` e "só despesa
  confirmada" são **no backend, na RPC**, nunca só no front. Nenhuma RPC nova pode
  retornar conta/despesa de obra em `preco_fechado`. `EXECUTE` só para o papel do
  portal; nada de `anon` amplo. Passa pelo `rls-auditor` antes de merge.
- **Multi-tenant:** `cliente_id` novo é um segundo caminho de escopo até o cliente
  (além de `projeto_id`); ambos precisam bater `empresa_id`. Um cliente jamais vê
  obra de outro cliente da mesma empresa (mesma classe de bug que a
  `20260720000004` corrigiu para entregas).
- **Performance:** lista de despesas paginada/limitada; sem full-scan por obra.

## Critérios de aceite

- [ ] Dado um cliente logado no portal com uma obra `administracao` sua e visível,
      quando abre a obra, então vê cronograma + prestação de contas (aportes,
      despesas com nota, saldo, taxa).
- [ ] Dado uma obra em `preco_fechado` do mesmo cliente, então ela **não aparece**
      no portal (nem cronograma, nem conta), mesmo se marcada visível.
- [ ] Dado uma despesa em conferência (não confirmada), quando o cliente abre a
      conta, então essa despesa **não** consta e o saldo não a considera.
- [ ] Dado que a equipe confirma essa despesa, quando o cliente recarrega, então
      ela passa a constar e o saldo atualiza.
- [ ] Borda / segurança: dado o token do cliente A, quando uma RPC é chamada com o
      `obra_id` de um cliente B (mesma empresa ou outra), então retorna vazio/erro,
      nunca os dados de B.
- [ ] Borda / segurança: dado qualquer chamada, não existe caminho de RPC que
      retorne cotação/proposta de fornecedor ao portal.
- [ ] Dado uma obra sem `cliente_id`, então não aparece em portal nenhum.

## Dados e contratos

- **`obras`**: nova coluna `cliente_id uuid` (FK `clientes`, nullable),
  `visivel_portal boolean default false`. Migration + `gen:types`.
- **`obra_conta_lancamento`**: campo de confirmação para o gate do requisito 4.
  Reusar `status`/`confirmado` se já houver; senão adicionar `confirmado boolean
default false` (a definir no plano, olhando o schema atual). Despesa só entra no
  portal com confirmado = true.
- **RPCs novas** (`SECURITY DEFINER`, entrada `p_token` + `p_obra_id`):
  - `get_cliente_obras(p_token)` → obras visíveis do cliente (id, nome, status,
    % avanço, datas). Filtra `administracao` + `visivel_portal` + escopo por token.
  - `get_cliente_obra_detail(p_token, p_obra_id)` → cronograma (frentes + passos
    com estado) + conta (aportes, despesas confirmadas com comprovante, saldo,
    taxa). Recusa se a obra não é do cliente do token ou não é `administracao`.
- **Front:** componentes reusam `PortalTimeline` (cronograma) e uma variação de
  `PortalFinanceiro` para a conta da obra. Ponto de entrada: aba/rota "Obra"
  dentro do detalhe do cliente no portal (`src/pages/cliente/`).

## Plano de implementação

Preenchido em plan mode e aprovado antes de gerar código. Esboço:

**Fase 0 — validação barata (sem código):** screen-share da tela interna de
conta-da-obra pro dono (Rafa, via VRZ) confirmar que a prestação de contas é o que
ele quer ver. Se o conteúdo não serve, não vale construir a superfície de auth.

**Fase 1 — backend + segurança:** migration (`cliente_id`, `visivel_portal`,
confirmação de despesa) + as duas RPCs com os gates; `gen:types`; testes das RPCs
(escopo, gate de modalidade, gate de confirmado); `rls-auditor` antes de merge.

**Fase 2 — frontend do portal:** rota/aba "Obra" no portal, cronograma via
`PortalTimeline`, conta via variação de `PortalFinanceiro`; toggle "visível no
portal" na tela interna da obra.

**Fase 3 — captura leve de campo (equipe, não cliente):** ligar `comprovante_url`
no `LancamentoContaDialog` (existe no banco, não está na UI) + foto de avanço por
link no cronograma/RDO, usável no celular pelo residente. Sem app novo, sem
Storage, sem offline.

## Decisões e riscos

- **Decisão (CEO):** vínculo por `obras.cliente_id` próprio (não herdar de
  `projeto_id`), para a obra avulsa também aparecer. Custo: segundo caminho de
  tenancy — revisão de segurança obrigatória.
- **Decisão (CEO):** publicação **ao vivo**, não fechamento mensal revisado.
  **Risco:** o design partner (VRZ) disse explicitamente que não quer o cliente
  vendo lançamento ainda em conferência, e que número que muda retroativamente
  destrói a confiança. **Mitigação adotada:** ao vivo **do confirmado** — a despesa
  nasce em conferência (invisível) e aparece no instante em que a equipe confirma
  (requisito 4). Sem isso, o portal vira risco de relação, não ativo.
- **Risco de vazamento de margem:** o furo fatal é expor conta/cotação em
  `preco_fechado`. Endereçado pelo gate no backend (requisito 1 + não-funcional de
  segurança). Qualquer endpoint novo de obra no portal tem que repetir o gate.
- **Fora agora (app de campo pro operário):** matado neste ciclo. O usuário de
  campo é do empreiteiro terceiro (o escritório não fornece MO); dar-lhe login
  exige uma terceira classe de identidade + Storage + offline/LGPD, e reabre o
  "app de canteiro" que os painéis já recusaram por competir com Mobuss/Prevision.
  Sem gatilho novo e modelo de identidade decidido, não se constrói.
- **ADR?** O `cliente_id` em obra + o gate de modalidade no portal é decisão
  transversal (tenancy + exposição financeira). Avaliar abrir ADR curto no plano.
