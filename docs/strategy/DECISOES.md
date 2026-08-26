# Decisões de direção (log vivo)

Log das decisões de direção do CEO, mais recente primeiro. **Fonte de verdade quando conflitar
com qualquer outro doc de estratégia**: os docs longos (STRATEGY_V2, ESTRATEGIA_PRODUTO, ICP,
PRICING) descrevem o quadro; este arquivo registra o que mudou desde que foram escritos.

Regras de manutenção:

- Toda decisão de direção nova entra aqui NA HORA, no topo, com data, decisão em 1 frase,
  contexto em 2-3 linhas e o que ela supera.
- Decisão que muda arquitetura/stack vira ADR (`docs/architecture/adr/`) e ganha só um ponteiro aqui.
- Decisão sensível (segurança, marca não registrada, dado de cliente) NÃO entra aqui: o repo é
  público. Fica na memória do projeto e é passada no prompt quando relevante.
- Os agentes de time (`.claude/agents/`) leem este arquivo antes de qualquer análise, por
  protocolo escrito nos próprios agentes.

---

## 2026-08-26 (à noite) · Gate D2 fechado: orçamento continua por disciplina/etapa, não por ambiente

**Decisão:** o Pilar não migra pra orçamento paramétrico por ambiente (pavimento → ambiente →
composição de custo, no espírito do Time 2 Build). O modelo atual (Escopo/Aditivo, por
disciplina e etapa) é o certo pro ICP de engenharia multidisciplinar.

**Contexto:** o gate D2 do backlog T2B→Pilar estava em aberto desde 25/08, com recomendação da
mesa de agentes de só reabrir com sinal comportamental de design partner pagante (a amostra de
validação disponível é viciada: Mawe é escritório de arquitetura, anti-ICP declarado; VRZ não
paga). O CEO decidiu direto, sem esperar essa validação: disciplina/etapa é o modelo certo.

**Supera:** fecha definitivamente a trilha C do Mapa de Melhorias (catálogo de composição de
custo, templates por tipo de obra, composição global por pontos, BDI em cascata, orçamento por
ambiente, IA de leitura de planta) — deixa de ser "gated D2, aguardando validação" e vira "não
faz, decisão tomada". OBR-7 fecha. O item H4 do backlog original (perguntar aos design
partners) fica sem objeto: a resposta não muda mais a decisão.

**Como aplicar:** qualquer pedido futuro de "orçamento por ambiente" ou "catálogo de
composição" nasce contra esta decisão; um agente pode discordar, mas citando este registro,
não uma comparação genérica com concorrente. OBR-3 (medição → fatura) segue como indicador de
avanço junto ao marco de faturamento (Opção A), nunca como motor automático de cobrança
derivado de composição de preço, porque essa peça de infraestrutura (catálogo com preço
unitário por item) não vai existir.

---

## 2026-08-26 · Correção factual: Obras não está tão fraco quanto a entrada de 25/08 supõe

**Não é uma nova decisão de direção** (a de 25/08 abaixo continua valendo: Obras é prioridade),
é uma correção de premissa que mudaria a leitura de quem ler só a entrada de 25/08. Ao escrever
a spec 062, a leitura de `docs/specs/040-obra-inteligente-cronograma-diario-clima.md`,
`018-cotacoes-na-obra.md` e `042-pilar-campo-app-de-campo.md` (todas "Entregue" ou "Em
implementação") mostrou que o diário já reporta contra o cronograma com alerta de clima, a
cotação já compara fornecedores e decide, e existe um **PWA offline completo para o campo**
(Pilar Campo, spec 042, credencial gerada pelo gestor, foto, fila de sincronização) que a
memória de 11-13/08 registrava como pendente e já está nas fases 1-5 entregues.

**Como isso muda a execução (não a prioridade):** o gap real em Obras é mais estreito e mais
barato do que "diário estruturado do zero" sugeria: ver spec 062 (efetivo por fornecedor,
impedimento tipado, visita ligada ao cadastro) como o primeiro corte, não um redesenho do
módulo. Antes de especificar a próxima peça de Obras, ler as specs 015/018/020/027/040/042
inteiras, não só a memória de sessões passadas.

---

## 2026-08-25 · Módulo Obras é a frente prioritária de melhoria do produto

**Decisão:** melhorar o módulo Obras (hoje o mais fraco do produto) é a prioridade de roadmap,
minerando o bloco de execução mapeado na auditoria competitiva do Time 2 Build: diário de obra
estruturado, fluxo formal de cotação/compras em volta do `ai-cotacao-import`, e medições,
adaptados ao ICP do Pilar.

**Contexto:** a mesa de agentes de 25/08 recomendou não atacar Obras (proteção de ICP contra
"soar construtora"). O CEO rejeitou esse veredito: o módulo existe, está em produção, é o mais
fraco, e é onde ele quer melhorar agora.

**Supera:** o gate D1 do backlog T2B→Pilar ("não entrar em operação de canteiro") deixa de ser
um não; vira uma questão de PROFUNDIDADE, ainda aberta (até onde entrar: acompanhamento
estruturado já decidido; PCP por ciclos completo e orçamento por ambiente seguem em avaliação,
ver gate D2). Agentes devem argumentar a partir desta decisão, podendo discordar dela, mas da
versão atual, não da antiga.

---

## 2026-08-26 (mais tarde) · Achado: OBR-3 (medição vira fatura) tem dependência de arquitetura não resolvida

**Não é uma decisão de direção**, é um achado técnico que muda a ordem de execução dentro da
Frente Obras. Ao escopar a spec seguinte (OBR-3, medições por período ligadas à fatura), a
leitura de `marcos_faturamento` (`005_orcamento_marcos_faturas.sql`) mostrou que o marco é
vinculado a **`projeto_id`** (não a `obra_id`), tem `valor` fixo definido na proposta/orçamento,
e vira receita via `rpc_faturar_marco` sem depender de medição física nenhuma.

"Medição de obra fecha em fatura", no espírito do T2B, não tem onde encaixar nesse modelo sem
uma decisão real: um marco pode nascer do progresso medido, ou a medição só serve de evidência
pra decidir manualmente faturar um marco já existente? Isso é decisão de produto (como o Pilar
liga execução física a faturamento), não implementação.

**Ordem revisada:** OBR-4 (Curva S da obra) entra antes de OBR-3, por ser autocontido — usa
`obra_rdo_tarefa` (spec 040) e as datas do cronograma de 2 níveis (spec 027), sem tocar em
faturamento. OBR-3 volta à fila quando essa decisão de marco↔medição estiver tomada.
