# SPEC 096: Notificação por e-mail (imediata por severidade + resumo semanal)

**Data:** 2026-09-04
**Status:** Draft
**Autor:** Matheus (CEO) + Claude
**Módulo:** notificações (transversal)
**Depende de:** [SPEC 095](095-padronizacao-de-email-transacional.md) (Fases 0 a 2), [ADR 0015](../architecture/adr/0015-notificacoes-por-destinatario.md), [ADR 0039](../architecture/adr/0039-email-transacional-modulo-unico-resend-e-log.md), [SPEC 029](029-central-de-notificacoes.md), [SPEC 091](091-notificacoes-alinhadas-por-papel.md)

<!-- Origem: CEO em 04/09: "tenho minhas notificações apenas via app, quero disparo por e-mail".
A spec 029 já previu o canal (coluna notificacao_preferencias.email, switch "em breve" na UI)
e deixou o disparo para depois. Este é o depois. -->

## Problema

O sócio do escritório não vive dentro do Pilar. Parcela vencida, disciplina atrasada, orçamento
estourado e aditivo pendente ficam no sino esperando ele abrir o app. Hoje a notificação só
existe in-app (spec 029), e o dado de leitura mostra que boa parte nunca é lida a tempo
(migration `20260894000000` removeu tipos com 0% de leitura). O canal que alcança o sócio fora
do app é o e-mail, e a infra (Resend, preferência por categoria) já existe sem estar ligada.

## Objetivo

Toda notificação in-app pode chegar também por e-mail, respeitando a preferência por categoria
do usuário: as de severidade `high`/`critical` saem em minutos (se ainda não foram lidas no app),
as demais vão num único resumo **semanal**, na segunda-feira às 08:00 de Brasília. O usuário liga e desliga por
categoria no mesmo diálogo de preferências de hoje, e todo e-mail tem link para gerenciar isso.

Depois desta feature, o dono que passou a semana fora do Pilar recebe na segunda "3 parcelas vencem
esta semana, 1 disciplina atrasada, 1 aditivo aguardando" com link direto em cada item; e um
`orcamento_excedido` chega no e-mail dele em até 10 minutos, sem esperar o resumo.

**Fora de escopo:**

- Push de browser/mobile e WhatsApp.
- Frequência e horário configuráveis por usuário (fixo: segunda-feira, 08:00 America/Sao_Paulo).
  Diário foi descartado e mensal recusado, ver Decisões.
- Silenciar por item ("mutar este projeto"). Preferência segue por categoria.
- Notificação de `agent_runs` (inbox de revisão em `/agentes`) por e-mail.
- E-mail para `pessoas` sem conta (`profile_id` nulo). Destinatário é sempre `profiles`.
- Domínio de envio por escritório (SPEC 095 mantém domínio do Pilar).

## Requisitos

Funcionais:

1. **Outbox = `notificacoes`.** Nova coluna `notificacoes.email_enviado_em timestamptz` (nulo =
   ainda não foi por e-mail). Nenhuma tabela de fila nova: a linha da notificação já tem
   destinatário, categoria, severidade, título, mensagem e link.
2. **Preferência por categoria, canal e-mail.** `notificacao_preferencias.email` (já existe) passa
   a valer. Sem linha para a categoria, vale o padrão: e-mail **ligado** para `financeiro`,
   `projeto`, `disciplina`, `obra`; **desligado** para `tarefa` e `sistema`. O `Switch` de e-mail em
   `PreferenciasDialog` deixa de ser `disabled`, mostra o padrão e grava.
3. **Dois modos, uma function.** Edge function `notificacoes-email-cron` recebe `{ modo:
'imediato' | 'semanal' }`, autenticada por service role (padrão de `trial-expiry-cron`).
   - `imediato`: a cada 5 min. Seleciona notificações `severidade in ('high','critical')`,
     `lido_em is null`, `arquivada_em is null`, `email_enviado_em is null`,
     `created_at <= now() - interval '5 minutes'` (janela pra quem já está no app ver antes) e
     `(expires_at is null or expires_at > now())`.
   - `semanal`: segunda-feira às 11:00 UTC (08:00 BRT). Seleciona TODAS as não lidas, não arquivadas, não
     expiradas com `email_enviado_em is null`, criadas nos últimos 7 dias (as `high` já enviadas no
     imediato não repetem porque têm `email_enviado_em`).
   - Ambos filtram por preferência do destinatário (req. 2), `profiles.deleted_at is null`, e-mail
     do perfil presente e não suprimido (`email_supressoes`, SPEC 095).
4. **Um e-mail por usuário por rodada.** Agrupa por `destinatario_id`; o e-mail lista os itens
   agrupados por categoria (ordem: financeiro, projeto, disciplina, obra, tarefa, sistema), cada
   item com severidade, título, mensagem e botão/link `APP_URL + link`. Máximo 20 itens no corpo;
   acima disso, "e mais N no Pilar" com link para o sino. Assunto: imediato = título da
   notificação (1 item) ou "N alertas importantes no Pilar"; semanal = "Seu resumo da semana: N
   pendências". O assunto nunca leva valor em R$: o título de notificação financeira nomeia o
   lançamento ("Pagamento vencido: aluguel do escritório") e o valor fica só no corpo, para não
   aparecer na tela de bloqueio do celular.
5. **Marcação e log.** Após `sendEmail` ok, `update notificacoes set email_enviado_em = now()
where id = any($ids)`. `email_envios` recebe 1 linha por e-mail (`tipo =
'notificacao_imediata' | 'notificacao_semanal'`, `classe='plataforma'`, `referencia_tipo =
'notificacoes_lote'`, `empresa_id` do destinatário). Falha no envio não marca e o item volta na
   próxima rodada (idempotência por `Idempotency-Key = notif-<modo>-<user>-<hash ids>`).
6. **Seleção em SQL, testável.** A seleção dos itens fica numa função `SECURITY DEFINER`
   `public.notificacoes_pendentes_email(p_modo text) returns table (destinatario_id, email, nome,
empresa_id, notificacao_id, categoria, severidade, titulo, mensagem, link, created_at)`,
   revogada de `PUBLIC` e `authenticated`, chamada pela edge function com service role. A regra de
   preferência/padrão vive nessa função, não em TypeScript.
7. **Gerenciar no rodapé.** Todo e-mail de notificação tem "Gerenciar notificações por e-mail" →
   `${APP_URL}/?abrir=preferencias-notificacao`, e o app abre `PreferenciasDialog` ao ler esse
   parâmetro (após login). Header `List-Unsubscribe` com o mesmo link (one-click assinado fica
   para v2).
8. **Sem retroativo.** A migration seta `email_enviado_em = created_at` para todas as
   notificações existentes: ninguém recebe um resumo com semanas de histórico no primeiro envio.
9. **Monitoramento.** Os dois jobs pg_cron seguem o padrão `*_monitored` do ADR 0036 (check-in no
   Sentry Crons). Métrica `email.notificacao.enviados` por modo.

Não-funcionais:

- **Segurança / RLS (ADR 0015):** `notificacoes` não ganha policy nova. `email_enviado_em` é
  escrito só pela function com service role. `notificacoes_pendentes_email` é `SECURITY DEFINER`
  sem grant para `authenticated`; pgTAP prova que `authenticated` recebe `permission denied`
  (memória: testar com `set role`, não como superuser, e `throws_ok` com a mensagem explícita).
- **Multi-tenant (ADR 0001):** o agrupamento é por destinatário; um usuário só tem uma
  `empresa_id`, então o e-mail nunca mistura empresas. `email_envios.empresa_id` preenchido.
- **Privacidade:** e-mail de categoria `financeiro` só existe para quem já passou pelo roteamento
  `_notif_ve_financeiro` (SPEC 091); esta spec não decide destinatário, só transporta. Mensagem
  com valor em R$ vai no e-mail como já vai no sino.
- **Performance:** índice parcial `(email_enviado_em) where email_enviado_em is null and lido_em
is null and arquivada_em is null`; a function de seleção roda em < 1s com 10k linhas pendentes.
  Rodada imediata processa no máximo 200 destinatários por execução (o resto fica pra próxima); a
  rodada semanal roda a base inteira, uma vez por semana.
- **Entrega:** depende do DNS da SPEC 095 (DMARC) e do `replyTo` de plataforma existir.

## Critérios de aceite

- [ ] Dado um usuário com preferência `email=true` em `financeiro` e uma notificação
      `orcamento_excedido` (`high`) criada há 6 min e não lida, quando roda `modo=imediato`, então
      ele recebe 1 e-mail com esse item e `email_enviado_em` fica preenchido.
- [ ] Dada a mesma notificação criada há 2 min, quando roda `imediato`, então nada é enviado.
- [ ] Dada a mesma notificação já lida (`lido_em` preenchido), então nada é enviado.
- [ ] Dado usuário sem linha de preferência para `tarefa`, quando roda `semanal` com uma
      `tarefa_atribuida` pendente, então não recebe (padrão desligado); com uma
      `parcela_vence` (`financeiro`, padrão ligado), recebe.
- [ ] Dado usuário com 3 notificações `medium` de categorias diferentes, quando roda `semanal`,
      então recebe UM e-mail com 3 itens agrupados por categoria e os 3 links começam com `APP_URL`.
- [ ] Dado que o resumo semanal rodou na segunda às 08:00, quando roda de novo às 08:05, então não reenvia (todas já
      têm `email_enviado_em`).
- [ ] Dado `sendEmail` falhando (Resend 500 simulado), então `email_enviado_em` continua nulo,
      `email_envios.status='falhou'`, e a próxima rodada tenta de novo com a mesma `Idempotency-Key`.
- [ ] Dado e-mail do destinatário em `email_supressoes`, então é pulado e registrado `suprimido`.
- [ ] Dado `authenticated` chamando `notificacoes_pendentes_email('semanal')`, então `permission
  denied` (pgTAP).
- [ ] Dado o link "Gerenciar notificações por e-mail", quando o usuário logado abre, então o
      `PreferenciasDialog` aparece aberto na coluna E-mail.
- [ ] Dado a migration aplicada em base com notificações antigas, então nenhuma delas entra no
      primeiro `semanal`.
- [ ] Caso de borda: 25 itens pendentes no resumo semanal, então o e-mail mostra 20 e "e mais 5 no Pilar".
- [ ] Caso de borda: usuário com `deleted_at` preenchido não recebe nada.
- [ ] Caso de borda: notificação com `expires_at` no passado não entra em nenhum modo.

## Dados e contratos

```sql
alter table public.notificacoes add column email_enviado_em timestamptz;
update public.notificacoes set email_enviado_em = created_at where email_enviado_em is null; -- sem retroativo
create index idx_notificacoes_email_pendente on public.notificacoes (created_at)
  where email_enviado_em is null and lido_em is null and arquivada_em is null;

create or replace function public.notificacoes_pendentes_email(p_modo text)
returns table (
  destinatario_id uuid, email text, nome text, empresa_id uuid,
  notificacao_id uuid, categoria text, severidade text,
  titulo text, mensagem text, link text, created_at timestamptz
) language sql security definer set search_path = public as $$ ... $$;
revoke all on function public.notificacoes_pendentes_email(text) from public, authenticated;

-- pg_cron (padrão ADR 0036, wrappers *_monitored):
--   'notificacoes-email-imediato'  '*/5 * * * *'   → net.http_post(.../notificacoes-email-cron, {"modo":"imediato"})
--   'notificacoes-email-semanal'   '0 11 * * 1'    → net.http_post(.../notificacoes-email-cron, {"modo":"semanal"})
```

```ts
// _shared/email/templates/notificacoes.ts
export function templateNotificacoes(input: {
  nome: string | null;
  modo: "imediato" | "semanal";
  itens: Array<{
    categoria: string;
    severidade: string;
    titulo: string;
    mensagem: string | null;
    url: string;
    criadoEm: string;
  }>;
  totalOculto: number; // itens além dos 20 exibidos
  gerenciarUrl: string;
  sinoUrl: string;
}): { subject: string; html: string; text: string };
```

Front: `useNotificacaoPreferencias` grava `email`; `PreferenciasDialog` habilita o switch com o
padrão por categoria; leitura de `?abrir=preferencias-notificacao` no shell do app.

## Plano de implementação

1. **Migration + função de seleção + pgTAP** (`email_enviado_em`, índice, backfill,
   `notificacoes_pendentes_email`, testes de preferência padrão/explícita, lido, expirado,
   janela de 5 min, permissão). `gen:types`.
2. **Template `templates/notificacoes.ts`** no módulo da SPEC 095, com teste Deno de agrupamento,
   limite de 20 e escape. Preview no `email:preview` com fixture de 1 item e de 25 itens.
3. **Edge function `notificacoes-email-cron`**: seleção → agrupamento → `sendEmail` → marcação,
   com limite de 200 destinatários por rodada e métrica. Teste Deno da função pura de
   agrupamento/assunto.
4. **Crons pg_cron** com wrappers monitorados + registro no Sentry Crons (ADR 0036). Só em staging
   primeiro; prod na release seguinte.
5. **Front**: switch de e-mail ativo, padrão visível, deep link `?abrir=preferencias-notificacao`.
6. **Verificação em staging**: criar notificação `high` real (ex.: via `gerar_notificacoes_ambient`
   em empresa de teste), esperar a rodada, receber; rodar o resumo manual com `{"modo":"semanal"}`.
7. **Anúncio in-app** (1 linha na central: "Agora você também recebe por e-mail. Ajustar") na
   primeira sessão após o release, para o padrão ligado não pegar ninguém de surpresa.

## Decisões e riscos

- **Decisão do CEO (04/09):** o resumo é **semanal** (segunda, 08:00), não diário. Diário foi
  recusado por ruído: quem recebe todo dia para de abrir, e o que importa de verdade já tem o
  disparo imediato. **Mensal** foi considerado e recusado no mesmo passo: parcela vencida,
  disciplina atrasada e orçamento estourado perdem sentido em 30 dias, e o resumo chegaria com
  pendência já resolvida. Se a leitura do semanal cair, o próximo passo é frequência por usuário,
  não mudar o padrão de todos.
- **Matriz de destinatários:** quem recebe cada notificação está em
  [docs/operations/EMAILS.md](../operations/EMAILS.md), levantada do roteamento real das
  migrations. Categoria financeiro nunca sai para coordenador nem colaborador: o e-mail não
  decide destinatário, só transporta o que o sino já roteou.
- **Decisão de produto (recomendação, a confirmar pelo CEO):** padrão LIGADO para financeiro,
  projeto, disciplina e obra. Motivo: o ICP não abre o app todo dia e essas categorias são o que
  ele pagaria pra saber; `tarefa` é ruidosa e `sistema` está sem evento. Alternativa
  conservadora: tudo desligado com anúncio in-app. Registrar em `DECISOES.md` quando decidir.
- **Decisão técnica:** outbox na própria `notificacoes` em vez de fila separada ou `pg_net` por
  linha. Motivo: dedup e leitura já vivem ali, uma varredura a cada 5 min é "imediato" o bastante,
  e a janela de 5 min evita e-mail do que a pessoa acabou de ver no app. Coberto pelo ADR 0039
  (item outbox) e pelo ADR 0015; não precisa de ADR próprio.
- **Risco:** o resumo das 11:00 UTC concorre com o `gerar_notificacoes_ambient` das 06:00 UTC.
  Ordem já favorável: o gerador roda antes, o resumo pega o que ele achou.
- **Risco:** volume. Hoje < 10 empresas ativas; 200 destinatários por rodada e 1 e-mail/usuário
  por rodada cabem com folga no plano free do Resend (100/dia) só no início; acompanhar em
  `email_envios` e subir de plano antes de bater o teto.
- **Suposição:** `profiles.email` está sincronizado com `auth.users.email`. Se não estiver, a
  função de seleção lê `auth.users` (é `SECURITY DEFINER`).
