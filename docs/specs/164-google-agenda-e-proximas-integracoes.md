# SPEC: Google Agenda conectado e as próximas integrações

**Data:** 2026-11-12  
**Status:** Em implementação (fases 1, 2 e 3 entregues nesta branch)  
**Autor:** —  
**Módulo:** tarefas | notificações | portal | projetos

## Problema

O dia do usuário está espalhado: prazos na Pilar, reuniões no Google Agenda, arquivos no Drive. Para saber que tem
reunião daqui a meia hora ele sai da Pilar. O CEO quer o dia inteiro dentro da plataforma (reter o usuário ali) e
pediu, em ordem: conectar o Google Agenda com aviso antes das reuniões, melhorar o convite do portal do cliente e
deixar os arquivos úteis mesmo sem o Drive conectado.

## Ordem de entrega

| #   | O quê                                                               | Por que nesta ordem                                                |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Google Agenda por pessoa: ver, criar e editar reunião + aviso antes | Pedido nº 1 do CEO; base para "o dia dentro da Pilar".             |
| 2   | Convite do portal: e-mail do cliente já preenchido e vários acessos | Atrito real no convite (digitar o e-mail que já está no cadastro). |
| 3   | Arquivos sem Drive: links (internos e do cliente) + botão conectar  | Aba Arquivos vazia sem Drive; o botão fixo puxa a conexão.         |
| 4   | Próximas integrações (lista abaixo)                                 | Decisão do CEO sobre qual vem depois.                              |

## Fase 1: Google Agenda (como ficou)

**Conexão por pessoa, não por escritório.** Diferente do Drive (SPEC 163, uma conta do escritório), agenda é
pessoal. Em Configurações > Integrações qualquer pessoa conecta a própria conta; ninguém vê a agenda do colega. O
mesmo cliente OAuth do Drive serve, com outro escopo e outra função de retorno.

**Escopo `calendar.events` (decisão do CEO, 2026-11-12).** A Pilar lê, cria, edita e exclui eventos da agenda
principal, como o Drive deixa criar pasta e enviar arquivo: a pessoa não precisa abrir o Google Agenda. Não mexe nas
configurações da agenda. É escopo sensível: o Google pede verificação do app (vídeo mostrando o uso), mas não a
auditoria anual (CASA) dos escopos restritos.

**Dados.** `google_agenda_conexoes` (token cifrado com a mesma chave do Drive, só service_role) e
`agenda_eventos_google` (cópia das reuniões de 30 dias para trás a 60 para frente; cada um lê as suas pela RLS). O
state do OAuth reaproveita `google_drive_oauth_estados` com a coluna `servico`.

**Sincronização.** A Edge Function `google-calendar` copia os eventos ao conectar, quando a pessoa toca em
"atualizar" na Agenda e no cron `google-agenda` (5 em 5 min, ressincroniza quem está há mais de 10 min sem
sincronizar, 40 por rodada). Entra só o que é reunião da pessoa: sai cancelado, recusado por ela, "fora do
escritório", foco e local de trabalho. Link de reunião só https (Meet, ou Zoom/Teams no campo local).

**Aviso no sino.** Padrão de 10 minutos antes, que a pessoa muda em Configurações > Integrações (na hora, 5, 10,
15, 30 min, 1 hora, 1 dia ou não avisar). Cada reunião pode ter o próprio aviso: é o lembrete pop-up do Google (o
que a pessoa marcou lá vale aqui, e o que marca aqui vai para lá). `agenda_gerar_lembretes()` roda todo minuto
(cron `google-agenda-lembretes`, só SQL) e avisa uma vez por reunião (volta a valer se o horário ou o aviso
mudar). A notificação é da categoria nova "Reuniões" (desligável em Preferências, sem e-mail por padrão) e, ao
tocar, abre a sala da reunião; sem sala, abre a Agenda.

**Na Agenda de Tarefas.** As reuniões viram a camada "Reuniões", com horário e onde ("14:00–15:00 · Meet"). Clicar
abre a reunião: entrar na sala, abrir no Google, editar (título, dia, horário, dia inteiro, convidados, local, sala do
Meet, aviso, descrição) e excluir. "Nova reunião" cria direto no Google, com sala do Meet e convite por e-mail aos
convidados. Reunião de que a pessoa é só convidada abre em leitura (só o organizador muda). Sem conexão, a barra da Agenda mostra "Conectar Google Agenda" (fica sempre à
mão, o mesmo raciocínio do botão de conectar o Drive). Acesso revogado no Google vira "Reconectar".

**Para ligar em cada ambiente:** ver `docs/operations/DEPLOY_CHECKLIST.md` (Google Calendar API, URI
`.../functions/v1/google-calendar`, escopo na tela de consentimento). Sem secret novo.

**Fora desta fase:** recorrência (criar reunião que se repete; editar uma ocorrência já funciona), outras agendas
além da principal, agenda da equipe (ver a do colega), Outlook, aviso por push no celular (depende do app/PWA com
push) e aviso por WhatsApp.

## Fase 2: convite do portal do cliente (como ficou)

- **E-mail puxado do cadastro.** O primeiro convite já vem com o e-mail do cliente, com o aviso "Puxado do cadastro
  do cliente. Confira antes de enviar."; o admin confirma ou troca. Cliente sem e-mail: o que for digitado fica no
  cadastro.
- **Vários acessos por cliente.** Cada e-mail é um acesso próprio do mesmo cliente (a esposa, o sócio), com nome
  opcional ("Maria, esposa"). Cada pessoa recebe o próprio convite e cria a própria senha (fluxo que já existia).
  Saiu a `UNIQUE (cliente_id, empresa_id)` de `cliente_portal_accounts`; continua `UNIQUE (empresa_id, email)`: no
  escritório um e-mail é de um cliente só (o convite avisa se o e-mail já acessa outro cliente).
- **Gerenciar acessos.** O diálogo lista quem entra (ativo ou convite pendente, último acesso) e, por pessoa,
  reenvia o convite ou manda novo acesso (`reset-cliente-portal-password` recebe `account_id`) e revoga só aquele
  acesso. Na página do cliente, o cartão do portal mostra quantas pessoas e quais e-mails, com "Gerenciar acessos".
- O portal não muda: tudo vem da sessão (conta → cliente), então cada pessoa vê os projetos do cliente.

## Fase 3: arquivos sem Drive conectado (como ficou)

- **Links na aba Arquivos, com ou sem Drive.** A aba ganha a seção "Links" (endereço + nome opcional) com a chave
  "O cliente vê no portal", ligada por padrão. Cada link mostra "o cliente vê" ou "só a equipe" e alterna com um
  toque. São os mesmos links do projeto (`projetos.links`, item ganha `cliente: true`); o que já existia segue só
  para a equipe.
- **No portal.** `portal-arquivos` devolve, na raiz, os links marcados para o cliente (só http/https), com ou sem
  Drive. O bloco "Arquivos do projeto" aparece quando há pasta ou link: links em cima, arquivos do Drive embaixo.
- **Botão de conectar fixo.** Sem Drive, a aba mostra o cartão "Conecte o Google Drive" (botão para o admin, aviso
  para os outros) acima dos links, em vez de uma tela vazia.
- **Pasta do cliente renomeada** para `Cliente (visível no portal)`, para quem mexe pelo Drive saber que o conteúdo
  aparece para o cliente. As pastas criadas com o nome antigo ("Cliente") são renomeadas na próxima vez que alguém
  que edita o projeto abre a aba (a Pilar pode renomear o que ela criou, escopo `drive.file`).

## Integrações sugeridas (para o CEO escolher a próxima)

Ordenadas por valor para escritório de projeto e por esforço:

1. **WhatsApp (API oficial do WhatsApp Business).** O cliente do escritório vive no WhatsApp. Avisar entrega nova no
   portal, proposta para aprovar e parcela vencendo, com o link do portal. Maior alavanca de uso do portal.
2. **Assinatura eletrônica (ZapSign, Clicksign ou D4Sign).** Proposta aprovada vira contrato assinado sem sair da
   Pilar; o status da assinatura volta sozinho. Fecha o ciclo Propostas → Projeto.
3. **NFS-e (Focus NFe, Nuvem Fiscal ou eNotas).** Emitir a nota de serviço quando a parcela é recebida. Tira o
   escritório do site da prefeitura todo mês.
4. **Microsoft 365 (Outlook Agenda e OneDrive).** Parte dos escritórios não usa Google. Mesmo desenho das fases 1 e
   da SPEC 163, outro provedor.
5. **Extrato bancário (Open Finance via Pluggy ou Belvo).** Conciliação automática do Fluxo de caixa.
6. **Reunião → ata e tarefas (Google Meet).** Com a agenda conectada, o agente prepara a ata e as tarefas da
   reunião para o usuário aprovar. Encaixa no pilar de agentes ("a IA prepara, você aprova").
7. **Reunião a partir do lead e do projeto.** Com a escrita no Google Agenda pronta, marcar a reunião direto do
   funil ou do projeto, já com o e-mail do cliente como convidado.

## Critérios de aceite (fase 1)

- [x] Qualquer pessoa conecta e desconecta a própria agenda; o retorno do Google volta para a tela de onde saiu.
- [x] Token cifrado; nenhum papel `authenticated` lê `google_agenda_conexoes`.
- [x] Cada pessoa lê só as próprias reuniões (RLS, teste pgTAP `google_agenda.sql`).
- [x] Reuniões aparecem como camada na Agenda de Tarefas; clicar abre o detalhe com entrar, editar e excluir.
- [x] Criar reunião pela Pilar grava no Google, com sala do Meet e convite aos convidados.
- [x] Aviso no sino 10 min antes por padrão, configurável por pessoa e por reunião, uma vez por reunião.
- [x] Acesso revogado no Google vira "Reconectar", não erro genérico.
- [ ] Verificação do app no Google com o escopo `calendar.events` (passo do CEO no Google Cloud).
