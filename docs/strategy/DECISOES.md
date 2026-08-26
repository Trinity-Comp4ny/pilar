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
