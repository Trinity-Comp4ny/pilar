# SPEC: Avisos do ultra admin por e-mail

**Data:** 2026-10-13
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** ultra-admin + notificações
**Relacionada:** [SPEC 104](104-trial-3-dias-e-empresa-convidada.md) (aviso de novo cadastro), [SPEC 112](112-feedback-no-banco-com-print-anotado.md) (feedback)

## Problema

Os avisos de plataforma pro ultra admin (novo cadastro, ativar plano bloqueado
por excesso de tentativas de cartão, feedback do app) só aparecem no sino. O
e-mail nunca sairia: `notificacoes_pendentes_email` exige que o destinatário
seja da empresa da notificação (o ultra admin nunca é da empresa do cliente que
se cadastrou) e a categoria `sistema` não vai por e-mail no padrão. Quem não
está com o app aberto perde o cadastro novo, que é justamente quando vale
falar com o lead.

## Objetivo

Todo aviso de plataforma que chega no sino de um ultra admin também chega por
e-mail, na hora, um e-mail por aviso, com link pra aba certa do `/ultra-admin`.

**Fora de escopo:**

- Preferência de canal pro ultra admin (ligar/desligar e-mail por tipo). São
  poucos avisos por dia; se virar ruído, entra depois.
- Mudar o `notificacoes-email-cron` ou o resumo semanal dos clientes.

## Requisitos

1. Toda notificação `categoria = 'sistema'` endereçada a um ultra admin
   dispara um e-mail pra ele, sem esperar e sem depender de leitura no sino.
2. Feedback (`feedback_recebido`) usa o e-mail próprio da SPEC 112 (texto
   inteiro, tela, print), reply-to de quem enviou.
3. Novo cadastro tem reply-to do dono da empresa nova: responder o e-mail fala
   com o lead.
4. Os outros avisos usam um e-mail genérico com título, texto, empresa, data e
   botão pro painel.
5. O link do aviso (sino e e-mail) abre a aba certa: novo cadastro em Trials,
   ativar plano bloqueado em Empresas, feedback em Feedback. `/ultra-admin?tab=`
   troca de aba mesmo com a página já aberta.
6. Ativar plano bloqueado mostra o nome da empresa, não o UUID.

Requisitos não-funcionais:

- **Isolamento:** a edge só manda pra destinatário com `role = 'ultra_admin'`
  (o trigger já filtra; a edge confere de novo). Notificação `sistema` de
  usuário comum não gera e-mail.
- **Não bloquear quem gerou o aviso:** o disparo é por `pg_net` (assíncrono) e
  qualquer falha vira `WARNING`, nunca derruba o cadastro, o feedback ou a
  ativação.
- **Sem duplicar:** a edge pula notificação com `email_enviado_em` e usa
  Idempotency-Key por notificação no Resend.

## Critérios de aceite

- [x] Dado um cadastro self-serve, quando `notificar_ultra_admins` roda, então
      o ultra admin recebe e-mail "Novo cadastro: ..." com link
      `/ultra-admin?tab=trials` e a notificação fica com `email_enviado_em`.
- [x] Dado um feedback enviado, então o ultra admin recebe o e-mail de
      feedback (não o genérico).
- [x] Dada uma notificação `sistema` pra um usuário comum, então nenhum e-mail
      é disparado.
- [x] Dada a mesma notificação reenviada à edge, então ela responde "já
      enviado" e não manda de novo.
- [ ] Caso de borda: sem os secrets `app_supabase_url`/`app_cron_secret` no
      vault, o aviso fica só no sino e nada quebra.

## Dados e contratos

Migration `20261024000001_avisos_ultra_admin_por_email.sql`:

- Trigger `aviso_ultra_admin_email` (`AFTER INSERT ON notificacoes`,
  `WHEN categoria = 'sistema'`): se o destinatário é ultra admin, `pg_net`
  chama a edge com `CRON_SECRET` (mesmos secrets do vault dos crons).
- `notificar_ultra_admins`: link padrão por tipo quando o chamador manda só
  `/ultra-admin`.

Edge `aviso-ultra-admin-email`: `POST { notificacao_id }`, `Authorization:
Bearer <CRON_SECRET>`. Templates `templateFeedbackRecebido` e
`templateAvisoPlataforma` (classe plataforma).

## Decisões e riscos

- Decisão: e-mail por trigger em `notificacoes`, não em cada origem. Um ponto
  só cobre os três avisos de hoje e qualquer `notificar_ultra_admins` futuro.
- Decisão: não reaproveitar o `notificacoes-email-cron`. Ele espera 5 min, só
  manda o que não foi lido e agrupa com os alertas da empresa do próprio ultra
  admin; aqui o pedido é saber na hora e com o aviso isolado.
- Risco: volume. Se cadastros crescerem muito, um e-mail por cadastro vira
  ruído; aí entra preferência por tipo ou um resumo diário.
