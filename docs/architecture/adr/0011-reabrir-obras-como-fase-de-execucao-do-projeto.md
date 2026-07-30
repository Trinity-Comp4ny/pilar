# ADR 0011: Reabrir Obras como a fase de execução de um projeto (gatilho atingido)

**Data:** 2026-07-30
**Status:** Accepted

## Contexto

`docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` adiou o módulo Obras "com
gatilho, não morto". A régua de reabertura estava escrita (linhas 113-115): **3
pagantes BR pedindo obra espontaneamente, OU 1 pagante do ICP com obra própria (a
VRZ se qualifica) topando design partner com upgrade de preço.** Obras também era um
dos "3 NÃO" (linha 167), pela associação com a demo de Angola (fora do ICP, não
pagante) e pelo risco de o produto escorregar para a anti-persona construtora.

Em 2026-07-30 o gatilho fechou pelo segundo caminho: a **VRZ**, pagante do ICP,
pediu acompanhamento da **obra própria** e topa ser design partner do módulo.
`<a confirmar: forma e data do pedido, e o upgrade de preço acordado>`. Isso destrava
a decisão de adiar; não a contradiz, era a condição prevista.

Duas forças moldam esta decisão:

1. **Posicionamento.** O escopo escolhido com o CEO é "a empresa executa a própria
   obra", a leitura que a estratégia associava à anti-persona. Assumida de olho
   aberto: seguimos o design partner real, não a régua abstrata. O contrapeso do Red
   Team fica registrado como risco, não como bloqueio.
2. **Modelagem.** A régua da spec 001 (`001-shell-3-pilares.md:35-40`) diz: "a
   entidade é da empresa; o módulo é dono da tela de administração; outros módulos
   referenciam a entidade e exibem recortes contextuais." A pergunta é onde a Obra
   se encaixa nisso.

Opções de modelagem consideradas:

- **Opção A — Obra como entidade/hierarquia independente** (cliente, equipe,
  cronograma e financeiro próprios). Contra: duplica projeto/cliente/pessoas,
  achata o modelo para "tudo é card" (recusado pelo painel em
  `DECISAO_MODULOS_INDEPENDENTES_2026-07-30.md`), e cria um segundo lugar para
  faturar. Fere a régua de 001.
- **Opção B — Obra como a fase de execução de um Projeto existente** (`obras.projeto_id`).
  Reusa cliente, disciplinas, equipe, cronograma e o Financeiro do projeto; o módulo
  Obras é dono só das telas próprias (diário, frentes). Pró: zero duplicação, segue a
  régua. Contra: acopla Obra a Projeto (uma obra sem projeto exige projeto "casca").
- **Opção C — sem tabela, só views sobre o que já existe.** Contra: o diário de obra
  (RDO) e as frentes de campo são dados novos que precisam de persistência própria;
  não dá para derivar de nada existente.

## Decisão

Adotar a **Opção B**. A Obra é a fase de execução de um Projeto, não um produto
paralelo.

- Nova tabela `obras` com `empresa_id` e `projeto_id` (FK). Uma obra referencia um
  projeto; herda dele cliente, disciplinas, equipe e cronograma.
- **Financeiro:** faturamento de obra sai do mesmo Financeiro do projeto (decisão de
  `DECISAO_MODULOS_INDEPENDENTES_2026-07-30.md:93-95`). O módulo Obras não cria um
  segundo motor de dinheiro; quando a medição entrar, ela alimenta o faturamento
  existente.
- **Calendário:** marcos de obra entram como a camada `"obra"` já prevista no
  `CAMADA_REGISTRY` do ADR 0010. Obras pluga uma camada, não um calendário novo.
- **Cronograma:** o avanço da obra se apoia no cronograma/Fluxos do projeto que já
  existe, não recria Gantt.
- **Escopo faseado, web-first.** MVP = Timeline, Diário (RDO) e Frentes/Tarefas, sem
  mobile offline, sem medição/faturamento, sem estoque, sem composição de custo
  (SINAPI/TCPO) nem curva ABC. Detalhe na spec 015.
- **Feature flag `obras`.** O módulo nasce atrás de flag por empresa/usuário; ligado
  para a VRZ, desligado para o resto. Rollback é um clique.

## Consequências

**Positivas:**

- Zero duplicação de cliente, equipe e financeiro; a Obra é um recorte a mais do
  projeto, coerente com a régua de 001 e com o calendário por camadas (0010).
- O faturamento continua num lugar só. Quando a medição chegar, ela pluga no
  Financeiro existente em vez de abrir um paralelo.
- Rollback trivial (flag off), como os demais módulos dormentes.

**Negativas (dívida assumida de olho aberto):**

- **Posicionamento.** Ao suportar execução própria, o Pilar entra no terreno de Vobi
  (~R$103), Contractor Foreman (~US$49) e ERPs BR (~R$399), que têm mais superfície
  de obra. Preço e escopo viram conversa. Mitigação: escopo mínimo e vigiado; não
  perseguir SINAPI/curva ABC/estoque completo (`research/aec/`).
- **Mobile de campo** é o item mais caro e foi adiado (a VRZ lança do escritório
  hoje). Se o uso migrar para o canteiro, PWA offline vira fase própria.
- **Acoplamento a Projeto.** Uma obra exige um projeto. Se um dia existir obra sem
  projeto, será preciso um projeto "casca" ou revisar este ADR.
- **Storage de fotos** (quando o RDO ganhar imagem) esbarra na decisão de custo de
  25/07 (não colocar arquivo de cliente em free tier). Bucket privado + URL assinada
  - Supabase Pro são pré-requisito, tratados na fase que trouxer foto.

## Decisões relacionadas

- `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md`: adiamento com gatilho que
  este ADR destrava (gatilho atingido). Registra também os riscos do Red Team.
- ADR 0010 (calendário por camadas): a camada `"obra"` que este módulo consome.
- SPEC 001 (shell dos 3 pilares): a régua de composição e a página `/obras` "Em breve"
  que a spec 015 substitui.
- SPEC 015 (Obras — MVP): o QUÊ e o PORQUÊ do primeiro recorte.
- `DECISAO_MODULOS_INDEPENDENTES_2026-07-30.md`: Financeiro na fundação compartilhada.
