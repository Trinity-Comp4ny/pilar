# SPEC 128: Plataforma de marketing externa e funil por UTM

**Data:** 2026-10-16
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** ultra-admin (Time) + edge functions
**Relacionada:** [SPEC 126](126-time-de-agentes-no-ultra.md), [ADR 0061](../architecture/adr/0061-marketing-e-produto-proprio-o-pilar-devolve-o-funil.md), [ADR 0060](../architecture/adr/0060-agentes-de-operacao-medem-no-pilar-publicam-fora.md)

## Problema

Marketing virou produto próprio (plataforma web do repo `post-automation`), mas o Pilar ainda
mostrava uma ficha de Marketing com o plano de números das redes e previa receber esses números
(`ops-ingest`). E a plataforma não tinha como saber o que cada post rendeu depois do clique: cadastro,
ativação e pagamento só existem no banco do Pilar.

## Objetivo

O ultra admin abre a plataforma de marketing a partir do Time com um clique, e a plataforma lê do
Pilar quantos cadastros, ativados e pagantes cada link publicado trouxe.

**Fora de escopo:** login único entre os dois produtos (fica para a plataforma ter login por
cliente); métrica de rede social dentro do Pilar (sai do plano, ADR 0061).

## Requisitos

1. Ultra › Time › Marketing mostra "Campanhas, posts e vídeos ficam na plataforma de marketing",
   com o botão "Abrir plataforma de marketing" (nova aba) e o que o Pilar manda para lá.
2. A Central do Time tem o botão "Plataforma de marketing" no topo.
3. O agente `marketing` fica inativo e aparece com o status "Na plataforma de marketing".
4. `GET /functions/v1/ops-export-funil?desde=AAAA-MM-DD[&ate=AAAA-MM-DD]` com
   `Authorization: Bearer <OPS_EXPORT_TOKEN>` devolve `{ gerado_em, desde, ate, linhas }`, uma linha por
   dia de cadastro (Brasília) e `utm_source`/`utm_medium`/`utm_campaign`/`utm_content`, com
   `cadastros`, `ativados` (projeto real) e `pagantes` (assinatura paga hoje). UTM ausente vem "".
5. Sem token válido: 401. Data inválida, período invertido ou janela acima de 120 dias: 400.

Não-funcionais:

- **LGPD:** só contagem. Nenhum nome, e-mail, empresa ou id sai do Pilar.
- **Segurança:** a RPC `_ops_funil_por_utm` só executa pelo service role; o token é próprio da
  integração e gira sem afetar o cron.
- **Config:** `VITE_MARKETING_APP_URL` (opcional, URL validada no boot); `OPS_EXPORT_TOKEN` nas Edge
  Functions e na plataforma.

## Critérios de aceite

- [x] Dado um ultra admin no Time, então vê o botão "Plataforma de marketing" no topo e, na ficha de
      Marketing, "Abrir plataforma de marketing".
- [x] Dado usuário logado ou anon, então não executa `_ops_funil_por_utm` (pgTAP).
- [x] Dado um cadastro com `utm_content=dabc12345` e projeto real, então a linha do dia traz 1
      cadastro e 1 ativado (pgTAP).
- [x] Dado o endpoint sem token, então 401; com janela de 2025 até hoje, então 400 (teste local).
- [x] A resposta só tem dia, UTM e contagens (pgTAP confere as colunas).

## Dados e contratos

- Migration `20261106000000_ops_export_funil.sql`: `_ops_funil_por_utm(p_desde, p_ate)` e o agente
  `marketing` inativo.
- Edge `ops-export-funil` (verify_jwt off, token próprio).

## Telemetria

Log de cada exportação (período e número de linhas). A plataforma mede o resto.

## Decisões e riscos

- Fonte do `utm_content`: o `/cadastro` grava a UTM do primeiro toque em
  `raw_user_meta_data.origem` (SPEC 104). Link sem UTM entra como origem vazia.
- A plataforma precisa guardar `OPS_EXPORT_TOKEN` e o URL das Functions do Pilar de produção.
