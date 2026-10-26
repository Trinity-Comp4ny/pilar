# SPEC 129: Time de agentes, melhorias depois do primeiro dia em staging

**Data:** 2026-10-16
**Status:** Em implementação
**Autor:** Matheus Rezende + Claude
**Módulo:** ultra-admin (Time)

## Problema

O primeiro dia dos agentes em staging (16/10) mostrou que a fase 1 da
[SPEC 126](./126-time-de-agentes-no-ultra.md) roda (crons 7h, 7h05 e 7h10 ok, e-mail do Chefe
entregue, custo de IA em centavos), mas com quatro furos:

1. **Contato duplo.** O mesmo escritório recebeu dois rascunhos de WhatsApp no mesmo dia, um
   de Receita e um de Clientes. Para o cliente, parece que ninguém conversa dentro da Pilar.
2. **Empresa de teste conta como cliente.** Contas criadas para testar cobrança e cadastro
   entram em MRR, funil e nota de saúde, e geram rascunho de contato.
3. **A nota de saúde é uma foto.** Não mostra se o escritório está piorando, quantos módulos
   usa nem se ainda está no começo; queda de uso só aparece quando vira "sumiu".
4. **Ninguém sabe se o contato funcionou.** A ação vira "enviada" e some. Não dá para dizer
   se o agente ajuda ou só gera mensagem.

## Objetivo

Cada escritório recebe no máximo um contato do Time por vez, só cliente real entra nos
números, a nota mostra tendência e o resultado de cada contato é medido sozinho 7 dias depois.

**Fora de escopo:** agentes novos (ver "Próximos agentes"), tela nova, envio automático.

## Requisitos

1. **Um contato por escritório.** Antes de gravar rascunho de WhatsApp, o executor descarta o
   candidato se outro agente tem contato pendente com a mesma empresa ou enviou um há menos de
   3 dias (`RESPIRO_DIAS`). O descarte aparece no histórico com o motivo
   ("escritório já tem contato de Receita").
2. **Empresa interna.** `empresas.interna` (padrão `false`). O ultra admin marca pelo menu da
   empresa ("Marcar como empresa de teste" / "Contar nos números do Time"), via RPC
   `ops_marcar_empresa_interna`. Empresa interna sai de `ops_saude_empresas`, `ops_receita` e
   do funil por UTM.
3. **Saúde v2.** `ops_saude_empresas` passa a devolver:
   - `modulos_usados`: módulos distintos com escrita nos últimos 28 dias (`audit_logs`);
   - `nota_7d`: a nota de 7 dias atrás, lida do retrato diário (`null` sem retrato);
   - `estagio`: `onboarding` (menos de 14 dias), `adocao` (menos de 60) ou `maduro`.
4. **Queda de uso.** Clientes cria o candidato `queda_de_uso` quando a nota caiu 20 pontos ou
   mais em 7 dias e o escritório ainda não sumiu. Chave por semana ISO, então no máximo um por
   semana.
5. **Retrato diário.** Cada execução de agente grava os indicadores em `ops_metricas_diarias`
   (`fonte = 'pilar'`, chave `<agente>.<indicador>`) e a nota de cada empresa
   (`nota_saude`, dimensão = empresa).
6. **Desde ontem.** O e-mail do Chefe abre com o que mudou desde o retrato de ontem (MRR,
   pagantes, cadastros, em teste, escritórios em risco). Sem mudança, a linha não aparece.
7. **Efeito do contato.** O Chefe roda `_ops_avaliar_contatos()` antes do resumo. Contato de
   WhatsApp enviado há mais de 7 dias ganha `resultado.efeito`:
   - teste vencendo: funcionou se a assinatura ficou ativa;
   - pagamento em atraso: funcionou se saiu do atraso;
   - os outros motivos: funcionou se alguém da empresa acessou depois do envio.
     O e-mail mostra "X de Y funcionaram" (30 dias) e a ficha do agente, a taxa em 60 dias.
8. **Tela.** A coluna Saúde da tabela de Clientes mostra "caiu N em 7 dias" ou "subiu N em 7
   dias" quando a variação é de 5 pontos ou mais.

Não-funcionais:

- **Segurança:** `interna` fica fora do grant de coluna do `authenticated` (só a RPC do ultra
  admin escreve; `cross_tenant_matrix.sql` cobre). `_ops_avaliar_contatos` só para
  `service_role`.
- **Custo:** nenhuma chamada nova de modelo; tudo é SQL e regra.

## Critérios de aceite

- [x] Dado retrato de 7 dias atrás com nota 90 e escrita em lançamentos, então a saúde devolve
      `nota_7d = 90`, `modulos_usados >= 1` e `estagio = 'onboarding'` para empresa nova
      (pgTAP).
- [x] Dada empresa marcada como interna, então ela some de saúde e receita; admin da própria
      empresa recebe 42501 ao tentar marcar (pgTAP).
- [x] Dado contato de teste vencendo enviado há 8 dias e assinatura ativa, então
      `_ops_avaliar_contatos()` marca `funcionou`; contato de 2 dias não é avaliado (pgTAP).
- [x] Dado candidato de Clientes para empresa com WhatsApp pendente de Receita, então ele vira
      descarte com motivo (Deno).
- [x] Dada nota 85 há 7 dias e 60 hoje, então nasce `queda_de_uso` com chave da semana ISO;
      2027-01-01 cai em 2026-W53 (Deno).
- [x] "Desde ontem" formata MRR em reais e omite indicador sem mudança (Deno).
- [x] Tendência só aparece com variação de 5 ou mais; texto de efeito "2 de 3 contatos
      funcionaram" (vitest).

## Dados e contratos

- Migration `20261107000000_time_de_agentes_melhorias.sql`: coluna `empresas.interna`,
  `ops_marcar_empresa_interna(uuid, boolean)`, `ops_saude_empresas()` com três colunas novas
  (drop e recria, mudou o retorno), `ops_receita` e `_ops_funil_por_utm` sem empresa interna,
  `_ops_avaliar_contatos()`.
- `ops_acoes.resultado` ganha `efeito` (`funcionou` | `nao_funcionou`) e `avaliado_em`.
- `ops_metricas_diarias` passa a receber o retrato dos agentes (`fonte = 'pilar'`).

## Plano de implementação

1. [x] Migration + pgTAP (`time_de_agentes.sql` 43 testes, `cross_tenant_matrix.sql`).
2. [x] `regras.ts`: queda de uso, `semContatoDuplo`, `mudancasDesde`, `resumoEfeito` + testes.
3. [x] `index.ts`: retrato, coordenação entre agentes, avaliação e "desde ontem" no Chefe.
4. [x] Front: menu "empresa de teste", tendência na tabela, efeito no cabeçalho do agente.
5. [ ] Depois do merge: marcar no Ultra as empresas de teste de staging e de produção.

## Próximos agentes (fase 2 da SPEC 126, ordem proposta)

Produto e Ativação entraram na [SPEC 130](./130-agente-produto-e-regua-de-ativacao.md).

| Agente       | O que faz                                                                                                                                        | Depende de                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Qualidade    | Lista erros do Sentry por escritório afetado, avisa Clientes quando um cliente pagante bate em erro e propõe a mensagem "já corrigimos"          | token de leitura do Sentry como segredo da edge (o Matheus gera)                     |
| Produto      | Segunda 07h: módulos usados e ignorados por escritório (`audit_logs`), feedback agrupado por tema, onde o escritório em onboarding parou         | nada novo no banco; PostHog (SPEC 125) entra depois                                  |
| Ativação     | Régua D1, D3, D7, D14 do escritório em `onboarding`: um contato por marco, só se o marco não foi atingido (primeiro projeto, equipe, lançamento) | `estagio` desta spec; pode nascer como regra dentro de Clientes antes de virar ficha |
| Finanças     | MRR, custo de IA (`ai_token_ledger` + `ops_execucoes.custo_usd`) e infra, margem por plano                                                       | custo de infra informado à mão; fase 3                                               |
| Chefe com IA | Briefing do Chefe escrito pelo modelo sobre os mesmos números, com a lista de efeitos e descartes                                                | eval do prompt (ADR 0048)                                                            |

Ficha nova com layout próprio (painel de Qualidade, de Produto) passa antes por protótipo no
Claude Design. Agente que reusa a ficha atual (briefing, fila, histórico) não precisa.

## Decisões e riscos

- Fronteira e autonomia: [ADR 0060](../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md).
- "Funcionou" é correlação, não causa: o acesso depois do contato pode ter acontecido de
  qualquer jeito. Serve para comparar agentes e motivos entre si, não para provar efeito.
- `nota_7d` só existe 7 dias depois do primeiro retrato: na primeira semana após o deploy não
  há tendência nem queda de uso.
