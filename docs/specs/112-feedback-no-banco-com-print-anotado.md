# SPEC: Feedback no banco, com print anotado

**Data:** 2026-10-13
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** transversal (app inteiro) + ultra-admin
**Evolui:** [SPEC 056](056-feedback-bug-e-sugestao-feature.md)

## Problema

O modal de feedback da SPEC 056 manda bug pro Sentry (User Feedback) e
sugestão pra `feature_suggestions`. Em 13/10, nada tinha chegado em nenhum dos
dois (zero eventos de feedback no Sentry em 90 dias, zero linhas em prod e
staging), e o bug cai num lugar que ninguém abre: não aparece no `/ultra-admin`
nem avisa ninguém. Além disso, o usuário só consegue escrever texto: não dá pra
mostrar a tela com o problema, que é o jeito mais rápido de um engenheiro
explicar "esse número aqui está errado".

## Objetivo

Todo feedback (bug ou sugestão) vira uma linha no nosso banco, opcionalmente
com um print que o usuário capturou ou enviou e marcou à mão, e o ultra admin
fica sabendo pelo sino e por e-mail na hora, e vê tudo numa lista só no
`/ultra-admin`.

**Fora de escopo:**

- O mecanismo do e-mail em si: é o mesmo de todo aviso de plataforma do ultra
  admin, na [SPEC 113](113-avisos-do-ultra-admin-por-email.md).
- Mais de um print por feedback, vídeo, texto ou setas na anotação.
- Resposta ao usuário dentro do produto (continua sem histórico pro usuário).

## Requisitos

1. Bug e sugestão gravam em `feature_suggestions` (nome legado mantido pra não
   quebrar bundle antigo durante o deploy), com `tipo` (`bug`|`sugestao`).
   Bug não tem título.
2. O modal oferece "Anexar print" com três entradas: capturar a tela atual
   (Screen Capture API, só onde o navegador suporta), escolher imagem do
   computador/celular, ou colar (Ctrl+V) uma imagem.
3. Com a imagem anexada, o usuário pode desenhar à mão livre ou marcar
   retângulos por cima, desfazer o último traço e limpar. A imagem final
   (print + marcas) é o que sobe.
4. O print vai pro bucket privado `feedback-prints`, em `{user_id}/{uuid}.png`
   (ou `.jpg` se o PNG passar do limite), e o caminho fica em `print_path`.
5. Junto vai contexto técnico mínimo: rota, tamanho da janela, navegador,
   release. `empresa_id` é preenchido pelo banco a partir do perfil, nunca
   pelo client.
6. Bug continua indo também pro Sentry (best-effort, não bloqueia o envio); o
   id do evento fica em `sentry_event_id` pra ligar ao replay.
7. Cada feedback novo gera notificação no sino de todo ultra admin, com link
   pra aba Feedback do `/ultra-admin`, e um e-mail na hora pra todos eles
   (texto, autor, empresa, tela, se tem print), com reply-to de quem enviou.
   O print não vai no e-mail: abre só pelo painel.
8. A aba Feedback lista bug e sugestão juntos, com filtro por tipo, mostra
   empresa, rota, autor, data, status interno, e abre o print em tamanho real.

Requisitos não-funcionais:

- **Segurança / RLS:** `INSERT` exige `created_by = auth.uid()` e
  `print_path` dentro da pasta do próprio usuário. `SELECT`/`UPDATE` só
  `is_ultra_admin()`. No bucket: o dono escreve e lê só a própria pasta; ultra
  admin lê tudo. Bucket com limite de 5 MB e só `image/png`, `image/jpeg`,
  `image/webp`.
- **Validação na fronteira:** `tipo` e tamanho de `contexto` por `CHECK`;
  sugestão sem título é rejeitada pelo banco.
- **Privacidade:** o print pode conter dado do cliente do escritório (valores,
  nomes). Fica em bucket privado, nunca no Sentry, lido só por signed URL.

## Critérios de aceite

- [ ] Dado um usuário logado, quando ele envia um bug só com texto, então uma
      linha `tipo = 'bug'` aparece em `feature_suggestions` com `empresa_id`
      do perfil e o ultra admin recebe notificação no sino e um e-mail.
- [ ] Dado um print anexado e marcado, quando ele envia, então o arquivo está
      em `feedback-prints/{uid}/...` e a imagem salva contém as marcas.
- [ ] Dado um usuário comum, quando ele tenta gravar `print_path` na pasta de
      outro usuário, então a RLS rejeita o insert.
- [ ] Dado um usuário comum, quando ele tenta ler print de outro usuário no
      bucket, então não consegue.
- [ ] Dado o ultra admin na aba Feedback, quando ele clica no print, então a
      imagem abre via signed URL.
- [ ] Caso de borda: navegador sem `getDisplayMedia` (iOS) não mostra o botão
      de capturar; upload e colar continuam.
- [ ] Caso de borda: Sentry bloqueado (adblock) não impede o envio do bug.

## Dados e contratos

Migration `20261024000000_feedback_tipo_print_e_aviso.sql`:

- `feature_suggestions`: `tipo` (`bug`|`sugestao`, default `sugestao`),
  `titulo` vira nullable (obrigatório só em sugestão), `print_path`,
  `contexto jsonb` (≤ 4 KB), `empresa_id` (FK `empresas`, via trigger),
  `sentry_event_id`.
- Bucket `feedback-prints` (privado) + policies em `storage.objects`.
- Trigger `AFTER INSERT` chama `notificar()` (tipo `feedback_recebido`,
  referência ao próprio feedback); falha na notificação nunca derruba o
  insert. O e-mail sai da notificação (SPEC 113), com o template próprio
  `templateFeedbackRecebido` e reply-to de quem enviou.

## Decisões e riscos

- Decisão: a fonte de verdade do feedback é o nosso banco, não o Sentry. O
  Sentry fica como complemento do bug (replay da sessão), não como destino.
- Decisão: captura via Screen Capture API nativa em vez de biblioteca que
  re-renderiza o DOM (html2canvas e afins): fidelidade total e zero peso no
  bundle. Custo: o navegador pede permissão a cada captura e não existe no iOS.
- Decisão: anotação em `<canvas>` próprio (caneta + retângulo + desfazer), sem
  dependência nova.
- Risco: print com dado sensível de cliente. Mitigado por bucket privado e
  leitura só do ultra admin.
