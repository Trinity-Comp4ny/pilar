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

**Conexão pela API do Google, não por link de agenda.** A pessoa toca em "Conectar Google Agenda", entra na conta
Google e autoriza (OAuth, como no Drive). Não é colar o link iCal da agenda: o link só lê, atrasa horas e não deixa
criar reunião.

**Todas as agendas da conta (decisão do CEO, 2026-11-12).** Pessoal, trabalho, compartilhadas, feriados: a Pilar
lista as agendas da conta (`google_agenda_calendarios`) e copia as que estão ligadas. De partida vale o que está
marcado no Google; em Configurações > Integrações a pessoa liga e desliga cada uma (desligar tira as reuniões e os
avisos dela). Agenda só de livre/ocupado fica de fora; agenda só de leitura aparece, mas não aceita reunião nova. Ao
criar reunião, a pessoa escolhe em qual agenda (a principal de partida).

**Escopos `calendar.events` e `calendar.calendarlist.readonly` (decisão do CEO, 2026-11-12).** A Pilar lê, cria,
edita e exclui eventos, como o Drive deixa criar pasta e enviar arquivo: a pessoa não precisa abrir o Google Agenda.
O segundo escopo só lê a lista de agendas. Não mexe nas configurações da agenda. São escopos sensíveis: o Google pede
verificação do app (vídeo mostrando o uso, política de privacidade, até ~10 dias úteis), mas não a auditoria anual
(CASA) dos escopos restritos. A Calendar API é gratuita (cotas de 600 req/min por usuário).

**Dados.** `google_agenda_conexoes` (token cifrado com a mesma chave do Drive, só service_role),
`google_agenda_calendarios` (as agendas e a escolha de cada uma) e `agenda_eventos_google` (cópia das reuniões de 30
dias para trás a 60 para frente, com a agenda de origem; cada um lê as suas pela RLS). O
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

**Fora desta fase:** recorrência (criar reunião que se repete; editar uma ocorrência já funciona), agenda da equipe (ver a do colega), Outlook, aviso por push no celular (depende do app/PWA com
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

## Próximas integrações: comentários do CEO e custo (pesquisa de 2026-11-12)

Preços tirados das páginas dos fornecedores pela busca na web em 12/11/2026; conferir no site oficial antes de
fechar. Conversão aproximada: US$ 1 ≈ R$ 5,15.

| #   | Integração                                | CEO (12/11)                                  | Custo para a Pilar                                                                                                                                                                                                                                 | Quem mais paga                                              | Veredito                                                                                                                |
| --- | ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | WhatsApp (API oficial da Meta)            | Gostou muito: proposta, parcela, avisos      | Sem mensalidade. Utilidade (parcela vencendo, entrega nova) R$ 0,035/msg; marketing R$ 0,32; resposta do cliente: 1.000/mês grátis por número                                                                                                      | Nada além, se a Pilar enviar por um número dela             | **Próxima.** ~R$ 140/mês com 20 escritórios × 200 avisos                                                                |
| 2   | Assinatura eletrônica                     | Gostou muito: proposta assinada              | Autentique: grátis até 10–20 docs/mês, depois ~R$ 0,06 por documento + R$ 0,01 por signatário por e-mail. ZapSign R$ 69,90/mês (20 docs). DocuSign API US$ 50/mês                                                                                  | —                                                           | **Depois do WhatsApp.** Autentique para começar (grátis)                                                                |
| 3   | NFS-e (nota fiscal de serviço)            | Validar com escritórios; passo mais à frente | Focus NFe R$ 89,90/mês (100 notas, R$ 0,10 a extra); Notaas grátis até 20 notas/mês. Ou a API oficial do Emissor Nacional, gratuita                                                                                                                | Certificado digital A1 de cada escritório (~R$ 150–250/ano) | Validar a dor antes. Mais trabalho (certificado, prefeituras)                                                           |
| 4   | Microsoft 365 (Outlook Agenda e OneDrive) | Igual ao Google, uma integração a mais       | Grátis (Microsoft Graph). Registro do app no Entra ID e verificação de publisher (programa de parceiros)                                                                                                                                           | Licença M365 do escritório (ele já paga)                    | Quando aparecer escritório que não usa Google                                                                           |
| 5   | Extrato bancário (Open Finance)           | Acha caro (> R$ 2 mil/mês)                   | Confirmado: Pluggy a partir de R$ 2.500/mês; Belvo ~R$ 6.000/mês                                                                                                                                                                                   | —                                                           | **Não agora.** Fazer importação de OFX/CSV (grátis) e, se pedirem, API direta do Inter/Cora (grátis para o correntista) |
| 6   | Ata e tarefas da reunião                  | Usa o Granola; quer saber se conecta         | Meet: transcrição só no Workspace Business Standard ou acima, e ler o arquivo exige escopo restrito (CASA, US$ 540–4.500/ano). Granola tem API só nos planos Business (US$ 14/usuário) e MCP por usuário. Recall.ai (bot na reunião) US$ 0,50/hora | O escritório (plano do Workspace ou do Granola)             | Começar colando a transcrição (ou a chave da API do Granola) e o agente monta ata e tarefas; bot próprio só com demanda |
| 7   | Tarefas no Google Agenda                  | Ideia nova                                   | Grátis: o escopo `calendar.events` já pedido cobre                                                                                                                                                                                                 | —                                                           | Barato: entra junto da próxima rodada da agenda                                                                         |
| 8   | Marcar reunião com o lead pela Pilar      | Gostou                                       | Grátis: usa a escrita do Google Agenda pronta                                                                                                                                                                                                      | —                                                           | Junto do histórico do lead (abaixo)                                                                                     |

**WhatsApp, na prática.** API oficial, não as não oficiais (Z-API ~R$ 97/mês por número, Evolution API self-hosted):
elas imitam o WhatsApp Web, violam os termos e o número pode ser banido sem recurso. Exige verificar a empresa no
Meta Business e aprovar cada modelo de mensagem. Primeiro passo é semiautomático: a Pilar prepara a mensagem
("A parcela 3 de R$ 4.200 vence dia 20/11. Pix e boleto no portal: link") e o escritório toca em enviar; o envio
automático vem quando o escritório confiar.

**Histórico do lead (pedido do CEO).** Cada lead e cada cliente ganham uma linha do tempo do que aconteceu: proposta
enviada, vista, aprovada; reunião marcada, remarcada, desmarcada; mensagem de WhatsApp enviada; mudança de etapa no
funil. Vira base para o agente comercial e para a reunião com o lead (item 8).

**Ordem proposta:** (1) histórico do lead + reunião com o lead + tarefas na agenda (tudo grátis, usa o que já
existe); (2) WhatsApp semiautomático; (3) assinatura eletrônica (Autentique); (4) importação de extrato OFX; (5) NFS-e
depois de ouvir escritórios; Microsoft 365 e ata de reunião sob demanda.

## Critérios de aceite (fase 1)

- [x] Qualquer pessoa conecta e desconecta a própria agenda; o retorno do Google volta para a tela de onde saiu.
- [x] Token cifrado; nenhum papel `authenticated` lê `google_agenda_conexoes`.
- [x] Cada pessoa lê só as próprias reuniões (RLS, teste pgTAP `google_agenda.sql`).
- [x] Reuniões aparecem como camada na Agenda de Tarefas; clicar abre o detalhe com entrar, editar e excluir.
- [x] Criar reunião pela Pilar grava no Google, com sala do Meet e convite aos convidados.
- [x] Aviso no sino 10 min antes por padrão, configurável por pessoa e por reunião, uma vez por reunião.
- [x] Acesso revogado no Google vira "Reconectar", não erro genérico.
- [x] Todas as agendas da conta, cada uma ligável; reunião nova escolhe a agenda.
- [ ] Verificação do app no Google com os escopos `calendar.events` e `calendar.calendarlist.readonly` (passo do CEO
      no Google Cloud).
