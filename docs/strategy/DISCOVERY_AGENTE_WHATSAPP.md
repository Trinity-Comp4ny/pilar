# Discovery: agente do Pilar pelo WhatsApp

**Data:** 2026-11-10 · **Status:** discovery (não é decisão) · **Card:** 22 do backlog de
profissionalização

## A ideia

Referência: a Omie deixa operar o ERP pelo WhatsApp. O ICP (sócio de escritório de engenharia e
arquitetura) vive no WhatsApp; perguntar "quanto falta receber este mês?" ou "lança despesa de
R$ 300 de plotagem no projeto X" sem abrir o Pilar seria o agente indo até onde ele já está.

## O que já existe e limita

- **Decisão de 2026-10-15 (DECISOES.md):** sem API oficial do WhatsApp por enquanto; contato
  com cliente é por link `wa.me` com texto pronto, enviado pelo fundador. Esta discovery não
  muda isso: mudar é decisão do CEO.
- **SPEC 151:** a Pilar já é conector MCP de leitura para ChatGPT e Claude. Parte do "falar
  com o Pilar fora do Pilar" já está coberta para quem usa esses apps.
- **Agentes (SPEC 147):** o motor de consulta com ferramentas e a regra "a IA prepara, você
  aprova" estão prontos; o canal é que muda.

## Perguntas que a discovery precisa responder

1. **Demanda:** quantos dos escritórios ativos pediriam isso? (pergunta no NPS / conversa com o
   design partner; a lacuna "whatsapp" em `/ultra-admin/ajuda` também conta).
2. **Identidade:** como provar que o número é do usuário (vínculo com código no app, MFA para
   ação que mexe em dinheiro).
3. **Escrita:** ação pelo WhatsApp vira rascunho que a pessoa aprova no app, como no chat?
   (manter "a IA prepara, você aprova").
4. **Custo:** API oficial (Meta Cloud API) cobra por conversa; somar ao custo de token por
   mensagem e ver no pricing (`docs/strategy/PRICING.md`).
5. **LGPD:** dado financeiro passando pela Meta; base legal e aviso na política de privacidade
   (o reaceite dos Termos pelo admin, `AceiteTermosBanner`, serviria para o novo aceite).

## Sinal para seguir

Seguir só com 3 escritórios ativos pedindo e o pricing fechando a conta. Até lá, o caminho
barato é o conector MCP (SPEC 151) e o agente no canto da tela (SPEC 155).
