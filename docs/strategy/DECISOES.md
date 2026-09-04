# Decisões de direção (log vivo)

Log das decisões de direção do CEO, mais recente primeiro. **Fonte de verdade quando conflitar
com qualquer outro doc de estratégia**: os docs longos (STRATEGY_V2, ESTRATEGIA_PRODUTO, ICP,
PRICING) descrevem o quadro; este arquivo registra o que mudou desde que foram escritos.

Regras de manutenção:

- Toda decisão de direção nova entra aqui NA HORA, no topo, com data, decisão em 1 frase,
  contexto em 2-3 linhas e o que ela supera.

---

## 2026-09-04 · `/inicio` vira painel de gestão da empresa, não página de atalho

**Decisão:** `/inicio` deixa de ser porta de entrada com atalhos e passa a ser o painel
informativo que a empresa monitora, inclusive numa TV na parede do escritório: comercial
(conversão de proposta, motivo de perda, origem de lead), entrega (prazo, atraso por
disciplina, pontualidade histórica) e dinheiro (faturamento previsto vs real, margem por
projeto, concentração de cliente). Os blocos de atalho de hoje (barra dos agentes, radar,
calendário) continuam, no rodapé.

**Contexto:** pedido do Bruno (VRZ) em 04/09: quer indicador de gestão numa tela só, com
gráfico ou porcentagem, "porque aí a gente consegue entender onde a gente tá indo mal e
onde precisa melhorar". O CEO expandiu o pedido: além das métricas que ele listou, a tela
tem que servir de painel de TV para o escritório inteiro. Virou [SPEC 092](../specs/092-painel-de-gestao-no-inicio.md)
e [ADR 0037](../architecture/adr/0037-inicio-e-painel-de-gestao-nao-atalho.md).

**Sem nenhum dado financeiro (decidido no mesmo dia, depois do primeiro mockup):** o
painel não exibe receita, custo, margem, caixa nem faturamento, e a RPC não seleciona
coluna monetária de tabela alguma. Dinheiro tem acesso restrito por eixo próprio
(`financeiro_delegado`, ADR 0034) e a tela é para ficar numa TV do escritório, vista por
estagiário, cliente e visitante. Onde a medida natural seria dinheiro, o painel usa a
medida física: proposta em contagem, esforço em horas, escopo pendente em quantidade e
dias de espera. O eixo que entrou no lugar é **produtividade**: ritmo de entrega semanal,
horas estimado contra real, carga da equipe (em dia contra atrasada), fila de aprovação
de escopo e retrabalho por disciplina. Em modo TV, nome de pessoa vira iniciais.

**O que isso supera:** a intenção original da spec 001 para o Início (página de atalho
centrada na barra dos agentes). A barra continua existindo, mas não é mais o herói da
tela: o número é. Supera também a primeira versão da SPEC 092, que tinha uma seção
Dinheiro (faturamento previsto vs real, margem por projeto, aging, concentração de
cliente, aditivos); os blocos seguem válidos como ideia, e o lugar deles é o Financeiro.

**Consequência de produto que ficou registrada:** dois indicadores só podem existir depois
de migration, porque o schema atual não guarda a informação. `propostas` não registra
quando foi enviada nem quando foi decidida (só o status atual), então "propostas enviadas
no mês" e ciclo de venda não são calculáveis hoje. E `projetos.data_previsao` é editável
sem baseline, então medir pontualidade contra ela faz todo projeto com prazo empurrado
contar como entregue no prazo. Indicador de prazo só entra com `data_previsao_original`
congelada.

---

---

## 2026-09-04 · Valor de contrato é campo de quem tem Financeiro; quem só cadastra projeto não informa

**Decisão:** quem cadastra projeto sem acesso ao módulo Financeiro não vê nem informa valor de
contrato e margem. Cadastra o projeto sem valor e um admin completa depois. Não vamos abrir
exceção para o momento da criação nem delegar financeiro só para liberar esse campo.

**Contexto:** a Liz (VRZ) é quem cadastra todos os projetos do escritório e tem role `user`. O
hardening da SPEC 073 / ADR 0034 passou a barrar escrita de `valor_contrato` sem
`can_view_financeiro()`, e em produção o campo continuava visível para ela porque o guard de
front ficou em staging: ela preenchia e tomava erro. Considerada a alternativa de dar
`financeiro_delegado` para ela, foi recusada porque a flag libera o Financeiro inteiro, não só o
campo de valor, e a VRZ tem três admins que podem preencher.

**Supera:** nada anterior. Fecha a dúvida de fluxo que o PR #448 deixou aberta.

## 2026-09-03 · Asaas não conecta por empresa; serve só para a Pilar cobrar seus clientes

**Decisão:** a integração de Asaas por empresa (cada cliente do Pilar traz sua própria conta/API
key Asaas para cobrar os próprios clientes deles) é abandonada. Asaas serve exclusivamente para
a Pilar cobrar SEUS clientes (checkout, assinatura, compra de pacote de tokens) — o que já é como
o motor de tokens e o checkout funcionam hoje.

**Contexto:** achado em QA no admin da empresa (`/admin` → aba Integrações) — a tela de config
por empresa (`AsaasConfigForm`) nunca foi ligada a nenhum caso de uso real: nenhuma empresa em
produção tem `asaas_config` preenchido, e o hook que a alimentava (`useAsaasConfig`) não tinha
outro consumidor. Confirmado com o CEO: não é prioridade, não entra no roadmap.

**O que isso supera:** qualquer menção a "empresa conecta o próprio Asaas" em docs de estratégia
mais antigos. Removidas do admin da empresa as abas Parâmetros, Automações e Integrações (a
segunda mostrava "Integrações ativas" redundante com a terceira; a primeira eram só atalhos para
telas que já existem em outro lugar) — `ParametrosTab`, `AutomacoesTab`, `IntegracoesTab`,
`AsaasConfigForm` e `useAsaasConfig` removidos do código. `asaas_config` (tabela), o RLS, e as
edge functions `asaas-config`/`asaas-webhook`/`asaas-criar-cobranca` NÃO foram tocados nesta
limpeza (risco de quebrar o motor de tokens/checkout de plataforma, que pode reusar a mesma
tabela para a config da própria Pilar) — se sobrar código morto ligado a cobrança por empresa
(`useAsaasCriarCobranca`, não tinha consumidor nem antes desta limpeza), é auditoria separada.

O que substitui "Parâmetros/Automações/Integrações" no admin da empresa (provavelmente uso por
usuário e consumo de tokens) ainda não foi decidido — o CEO vai pensar numa seção nova.

---

## 2026-09-01 (mais tarde ainda) · Diário da obra vira feed visual (tipo Instagram), interno + versão curada no portal do cliente

**Decisão:** o Diário (RDO) ganha uma segunda forma de exibição, tipo feed de rede social
(um card por dia: data, status, resumo curto, fotos, quem lançou) — em duas superfícies:

1. **Dentro do sistema** (aba Diário, interno): feed mostra tudo, sem filtro — mesmo dado
   operacional que já existe hoje (efetivo, impedimento, visita, tarefas), só num formato mais
   visual.
2. **No portal do cliente**: feed com **resumo curado**, não o RDO cru. Mostra atividades do
   dia + fotos + clima; impedimento, efetivo por fornecedor e fornecedor específico ficam de
   fora. Mantém a fronteira que a spec 030 já tinha fechado ("cliente vê avanço e conta, não o
   diário operacional inteiro") — não reabre essa decisão, só adiciona um formato novo de
   exibir o que já era permitido mostrar.

**Contexto:** benchmark competitivo do Obra Guru (que expõe até ocorrência/impedimento como
card próprio no feed do cliente — considerado e descartado aqui) + pedido direto do CEO:
reduzir a pergunta recorrente do dono da obra pro gestor ("como foi hoje?"), que hoje só se
resolve com o cliente ligando ou o gestor mandando mensagem solta. RDO por voz (specs 080/086,
01/09) já captura o material bruto pro feed funcionar sem esforço extra de lançamento: resumo
de atividades, fotos, clima.

**Supera:** nada de direção — é uma extensão aditiva da spec 030 (que continua valendo pro que
NÃO aparece no portal), não uma reversão.

---

## 2026-09-01 (mais tarde) · Pacote de tokens vira 4 tiers fixos com desconto por volume

**Decisão:** a compra avulsa de tokens deixa de ser "quantidade livre de pacotes de 500k a
R$49 cada" e vira 4 tiers fixos, com preço por milhão de tokens caindo conforme o tier sobe:

| Tier | Tokens     | Preço | R$/milhão | Desconto vs. tier 1       |
| ---- | ---------- | ----- | --------- | ------------------------- |
| 1    | 500 mil    | R$49  | R$98,00   | — (preço-base inalterado) |
| 2    | 1,5 milhão | R$129 | R$86,00   | ~12%                      |
| 3    | 3 milhões  | R$228 | R$76,00   | ~22%                      |
| 4    | 6 milhões  | R$399 | R$66,50   | ~32%                      |

**Contexto:** feedback direto do CEO testando o fluxo de compra em staging — selecionar
quantidade num campo numérico e forma de pagamento num radio genérico "ficou muito ruim"
perto do padrão de mercado (OpenAI, Anthropic Console: tiers fixos como cards clicáveis).
Com o COGS medido (~R$3,50/milhão, ver MOTOR_DE_TOKENS.md §3), mesmo o tier 4 com 32% de
desconto mantém margem ~95% — desconto por volume aqui é alavanca de ticket médio e
conversão, não sacrifício de margem.

**Supera:** o modelo de "1-20 pacotes de 500k a R$49 cada" fixado nesta mesma sessão mais
cedo (SPEC 077). O preço do tier 1 (R$49/500k) não muda — só deixa de ser o único ponto
da curva.

**Como aplicar:** catálogo de tiers fica hardcoded no backend (`pilar-token-pack-create`),
nunca aceita preço do cliente. UI mostra os 4 tiers como cards, sem campo de quantidade
livre (SPEC 080). Recalibrar os números quando a Fase 0 (dado real de uso em produção)
confirmar o COGS medido.

---

## 2026-09-01 (mais tarde) · ICP expande de "engenharia multidisciplinar" para incluir arquitetura

**Decisão:** arquitetura deixa de ser anti-persona. O ICP passa a ser escritórios de projeto
técnico em geral — engenharia multidisciplinar (civil/estrutural/MEP) e arquitetura — que vendem
projeto por proposta e têm fluxo de disciplina/etapa, não só engenharia pura.

**Contexto:** Rafael (Mawe Arquitetura) é design partner desde 18/08 e é hoje o sinal de produto
mais forte que o Pilar tem: validou a metodologia de cronograma com pausa por etapa de forma
cruzada (prototipou o mesmo padrão fora do Pilar, sem ver o código), é a primeira reação
espontânea positiva forte ao portal do cliente (0% de adoção nas outras 4 empresas), e gerou
stories promovendo o Pilar por conta própria. `brand/personas.md` (mesa redonda 13/05) descartava
arquitetura por "fluxo criativo, fases diferentes" — na prática, o fluxo de disciplina→etapa que
o Pilar já modela serve os dois igualmente bem; a divergência prevista não se confirmou com uso
real.

**Supera:** a linha ❌ "Não é: arquitetura pura" de `brand/personas.md` e a tensão #1 de
`brand/BRAND.md` ("recomendo alinhar a copy pra engenharia") — o caminho inverso venceu: expandir
o ICP oficial, não estreitar a copy. Construtora/incorporadora (gestão de obra como núcleo)
continua fora — isso não mudou.

**Como aplicar:** copy, onboarding e priorização de feature passam a considerar arquitetura como
público primário, não caso lateral. `personas.md` e `BRAND.md` atualizados nesta mesma entrada.
Não implica perseguir arquitetura ativamente em GTM ainda — é ICP oficial, a validar com mais
design partners antes de virar mensagem de aquisição.

---

## 2026-09-01 · Ativação do Asaas de plataforma é iniciativa própria, sandbox primeiro

**Decisão:** ligar o Asaas que cobra a assinatura do Pilar (não o Asaas por-empresa, que já
tem UI e é opt-in do cliente) é trabalho separado do motor de tokens, começando por sandbox.
Produção só entra com um cliente concreto pronto pra pagar de verdade.

**Contexto:** testando o motor de tokens em staging, ficou claro que nenhum ambiente
(staging ou produção) tem qualquer credencial `ASAAS_PLATFORM_*` configurada — o checkout de
assinatura (`pilar-checkout-create`/`pilar-subscription-manage`) nunca foi ligado em lugar
nenhum, o que bate com "zero pagante". Levantamento completo em
`docs/operations/AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md`, que também corrige um erro anterior:
a Fase 3 do motor de tokens (compra de pacote) tinha sido descrita usando o Asaas por-empresa
(`asaas-criar-cobranca`); o certo é o Asaas de plataforma, o mesmo da assinatura.

**Supera:** a suposição registrada nas specs 074/075 do motor de tokens sobre qual Asaas a
Fase 3 usaria.

**Como aplicar:** próximo passo é o checklist de sandbox da auditoria (chave sandbox +
3 secrets + webhook de teste); a Fase 3 de tokens só volta à mesa depois disso estar rodando,
e reusa a mesma base de credencial.

- Decisão que muda arquitetura/stack vira ADR (`docs/architecture/adr/`) e ganha só um ponteiro aqui.
- Decisão sensível (segurança, marca não registrada, dado de cliente) NÃO entra aqui: o repo é
  público. Fica na memória do projeto e é passada no prompt quando relevante.
- Os agentes de time (`.claude/agents/`) leem este arquivo antes de qualquer análise, por
  protocolo escrito nos próprios agentes.

---

## 2026-08-31 · IA Hub inteiro sai do repo, junto com Capacidade e Templates: matar em vez de deixar apodrecer

**Decisão:** removidas as 11 edge functions do IA Hub (`ai-aditivo-copilot`, `ai-diagnostico-precificacao`,
`ai-proposta-copilot`, `ai-documentos`, `ai-fechamento-mensal`, `ai-pauta-reuniao`,
`ai-planejador-contratacao`, `ai-previsao-atraso`, `ai-radar-cliente`, `ai-relatorio-executivo`,
`ai-simulacao-impacto`), a página `/gestao/ai`, a flag `ai_hub`, a fila de revisão de orçamentos
dentro de `/agentes` (só existia pra aprovar output do `ai-proposta-copilot`), e as páginas de
Capacidade e Templates. ~7.400 linhas de código morto saíram junto (PRs #370, #371, #372).
`ai-chat`, `ai-cotacao-import` e `ai-import-financeiro` (as 3 IA vivas de verdade) não foram
tocadas.

**Contexto:** achado ao investigar o "núcleo defensável" de 3 tools que a discussão de 20/07
(`docs/strategy/DECISAO_IA_FEATURES_AGENTES_2026-07-20.md`) mandou manter (Aditivo, Precificação,
Proposta): as 3 estavam quebradas contra o schema atual, liam `.from("timesheets")`/
`.from("billing_milestones")`, tabelas renomeadas para `timesheet_lancamentos`/
`marcos_faturamento`. Ninguém ia ligar `ai_hub` (desligada em toda empresa) nos próximos 60 dias.
Em vez de consertar 2 queries pela metade pra uma feature que não vai ser usada, decidiu-se
deletar tudo. Capacidade e Templates saíram pelo mesmo padrão: `addon: true, dormant: true`,
desligadas desde a adoção, zero uso real.

**Supera:** o veredito "manter (tool)" de Aditivo/Precificação/Proposta na discussão de 20/07 —
essas 3 especificamente. As outras 8 já tinham veredito "matar"/"adiar" lá, sem mudança.

**Como aplicar:** se o IA Hub voltar a ser discutido, o ponto de partida não é "religar" o código
deletado (git guarda o histórico se precisar de referência) — é reconstruir contra
`projeto_disciplinas.horas_realizadas`/`tarefas.horas_reais`, que já capturam horas previstas e
reais por disciplina e por tarefa hoje (achado paralelo: não é o "Timesheet" dormente, é um campo
manual mais leve, editável em Projetos/Meu Trabalho, que só não estava plugado na conta de
margem — reconectado em Rentabilidade pelo PR #373).

---

## 2026-08-31 · Camada 2 de IA vira "token", não "ação de IA": reverte a doutrina de nunca expor token

**Decisão:** a unidade de uso de IA visível e comprável pelo cliente passa a ser **token**, pelo
nome, em toda superfície (saldo, cota do plano, compra de pacote extra). Não existe mais camada
de tradução "ação de IA" para o usuário final.

**Contexto:** `docs/strategy/PRICING.md` (decisão 17/08, item 3) registrava o oposto: "o cliente
nunca vê 'token'", com "ação de IA" como unidade traduzida e o token escondido como COGS
interno. O CEO decidiu direto o contrário: o termo "token" já é conhecido do cliente (mercado de
IA generalizou o termo) e não precisa de tradução.

**Supera:** o item 3 da revisão 17/08 do PRICING.md e a linha 166-168 ("Camada 2: Ações de IA")
do mesmo doc — ambos ficam obsoletos nesse ponto específico; o resto da Camada 2 (cota no plano,
pacote extra, margem ~2,5x custo) continua valendo, só troca a unidade e o nome. Todo texto de
produto, UI, e checkout que viesse a dizer "ação de IA" usa "token" em vez disso.

**Como aplicar:** o ledger de uso de IA (ver estrutura técnica combinada em 31/08, arquitetura
descrita na memória do projeto) usa `tokens` como unidade de cota, saldo e cobrança — sem
`peso_acao` nem conversão. `PRICING.md` precisa de um bloco de atualização apontando pra esta
entrada na próxima revisão do documento.

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
