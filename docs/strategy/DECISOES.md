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
