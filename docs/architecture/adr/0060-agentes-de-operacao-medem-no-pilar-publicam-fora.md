# ADR 0060: Agentes de operação medem no Pilar, publicam fora dele e só rascunham

**Data:** 2026-10-15
**Status:** Proposed. Parte de marketing (ficha com métricas de rede no Ultra e `ops-ingest`) substituída pela [ADR 0061](./0061-marketing-e-produto-proprio-o-pilar-devolve-o-funil.md).

## Contexto

A Pilar vai operar com um time de agentes (receita, clientes, marketing, produto,
qualidade) comandado do portal Ultra (SPEC 126). Três escolhas são caras de reverter:

1. **Onde mora o conteúdo social.** O repo `post-automation` (banco próprio) já gera
   post com crítico e bandit, coleta métricas de Instagram e LinkedIn e roteiriza Reels.
   - Opção A: trazer geração e publicação para o Pilar. Um painel só, mas duplica um
     sistema que já funciona, mistura token de rede social e mídia no banco do produto e
     prende o `post-automation` ao Pilar (ele caminha para ser multi-tenant).
   - Opção B: o `post-automation` publica e coleta; o Pilar recebe um snapshot e devolve
     o funil por UTM. Dois repos, contrato pequeno e assinado.
2. **Quem calcula o número.** Se o modelo calcula MRR ou conversão, o painel pode
   inventar número.
3. **Quanto o agente faz sozinho.** No lançamento um e-mail errado para um cliente custa
   mais que o tempo economizado.

## Decisão

- **Fronteira (opção B).** Geração, render, agendamento e publicação de conteúdo,
  coleta de redes sociais, anúncios e Search Console vivem no `post-automation` e no
  banco dele. O Pilar recebe só agregados por `ops-ingest` (HMAC) e devolve cadastros,
  ativados e pagantes por UTM por `ops-export-funil` (token, sem dado pessoal). Nenhum
  token de rede social fica no Pilar.
- **Número do SQL, texto do modelo.** Todo indicador do Time sai de RPC ou de
  `ops_metricas_diarias`. O modelo recebe os sinais prontos e só escreve briefing e
  rascunho, citando a evidência (ADR 0050). Mesmo princípio do resumo semanal do `/inicio`.
- **Autonomia por nível e por tipo de ação.** N0 observa, N1 rascunha e espera
  aprovação, N2 executa reversível e avisa, N3 autônomo. Todo envio externo começa em N1.
  Subir de nível é decisão manual, sugerida pelo painel depois de 20 aprovações seguidas
  sem edição daquele tipo.
- **WhatsApp por link.** A ação de WhatsApp abre `wa.me` com o texto pronto; não há
  integração com a API oficial.

## Consequências

**Positivas:**

- O Pilar não carrega token, mídia nem regra de rede social; o `post-automation` segue
  independente.
- O bandit de conteúdo passa a otimizar por cadastro ativado, não por curtida.
- Número no painel é auditável: a mesma RPC responde à tela e ao agente.
- Erro de agente no lançamento custa um rascunho descartado, não um cliente irritado.

**Negativas:**

- Dois deploys e dois segredos compartilhados (`OPS_INGEST_SECRET`, `OPS_EXPORT_TOKEN`)
  para manter e girar.
- O painel de marketing fica um dia atrasado (snapshot diário), aceitável para decisão
  semanal.
- N1 em tudo exige 15 a 20 minutos diários do fundador na fila.

## Decisões relacionadas

- [SPEC 126](../../specs/126-time-de-agentes-no-ultra.md), [SPEC 125](../../specs/125-telemetria-de-produto-e-erros.md)
- [ADR 0050](./0050-agente-que-grava-rascunho-cita-evidencia.md): agente cita evidência
- [ADR 0051](./0051-modelo-de-ia-por-configuracao-com-gateway.md): modelo por configuração
- [ADR 0039](./0039-email-transacional-modulo-unico-resend-e-log.md): envio de e-mail
