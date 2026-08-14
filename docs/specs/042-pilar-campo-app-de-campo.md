# SPEC: Pilar Campo — app de campo (offline)

**Data:** 2026-08-13
**Status:** Em implementação (fase 1: auth)
**Autor:** Matheus (design partner VRZ)
**Módulo:** obras

<!-- Origem: brain-dump do design partner (13/08), decisão do CEO de reativar o
app de campo (reverte spec 030). Nome escolhido: Pilar Campo. Contexto e decisões
em project_design_partner_obra_inteligente_2026-08-13 (memória). -->

## Problema

O avanço real da obra nasce no canteiro, mas hoje só entra no Pilar quando alguém
senta no escritório e digita o diário. O pessoal de campo (encarregado, mestre,
residente) está no celular, muitas vezes sem 4G bom, e não tem como registrar o
que fez, a foto do serviço e a medição na hora. O resultado chega tarde, resumido
e sem prova visual, o que enfraquece o loop cronograma⇄diário (spec 040) e a
prestação de contas ao dono (portal do cliente).

## Objetivo

Uma superfície **mobile-first, que funciona offline**, escopada a **uma obra**,
onde quem está no canteiro registra o dia (diário), marca o que andou nas tarefas
do cronograma, anexa foto e informa medição, e tudo sincroniza quando a conexão
volta. Depois desta feature, o avanço da obra passa a ser alimentado do campo, no
mesmo dia, com foto, sem depender de ninguém reabrir o Pilar no escritório.

**Fora de escopo (v1):**

- App nativo em loja (App Store/Play). É **PWA** (instala pela tela inicial do
  navegador), não pacote nativo.
- Chat, notificações push nativas, GPS/geofence, assinatura digital.
- Timesheet / apontamento de horas do pessoal de campo (é outra frente, o item 0).
- Edição do cronograma pelo campo (só reporta contra ele; estrutura é do escritório).
- Modo offline "para sempre": sincroniza quando houver rede; não é banco local
  completo, é uma fila de ações pendentes.

## Decisão-chave (DECIDIDA): credencial gerada pelo gestor (modelo do portal do cliente)

O usuário de campo é pedreiro/servente: gente simples que **não vai criar conta
nem gerenciar login**. Então o gestor **gera a credencial pronta** (email + senha)
e entrega, exatamente como o **portal do cliente** já faz. Não é self-service.

Mecanismo (espelha o portal do cliente, na versão já endurecida):

- Tabela `campo_accounts` análoga a `cliente_portal_accounts`: `id`, `empresa_id`,
  **`obra_id`** (escopo), `nome`, `email` (único), `senha_hash` (**bcrypt** via
  `crypt(senha, gen_salt('bf'))`), `ativo`, `must_change_senha`, `created_by`.
- Geração: edge `invite-campo` (padrão do `invite-cliente-portal`) — o gestor, na
  obra, cria o acesso; a edge gera uma senha curta, grava só o hash e **devolve a
  senha em claro uma vez** para o gestor copiar e entregar.
- Login: RPC custom `campo_login(email, senha)` (padrão do `portal_login`) —
  verifica `crypt(senha, senha_hash) = senha_hash` e devolve uma sessão (token) com
  o `obra_id` do acesso. Sem signup do Supabase, sem e-mail de confirmação.
- Troca de senha forçada no 1º acesso (`must_change_senha`), como o portal.

Diferença crítica vs portal (que é **read-only**): o campo **escreve**. A sessão de
campo autoriza **só** gravar diário/foto/medição da **sua obra** (`obra_id` do
token), nunca outra obra, nunca ler o resto da empresa. Cada RPC/policy de escrita
revalida o escopo da sessão. Passa **obrigatoriamente** pelo rls-auditor e por uma
revisão de segurança antes de produção (é superfície de escrita nova).

Trilha: as ações do campo entram como "via Pilar Campo", com o `campo_account` autor.

## Requisitos (MVP)

Funcionais, testáveis:

1. O gestor (com acesso à obra) gera/revoga um acesso de campo por obra; a geração
   devolve **email + senha** para ele copiar e entregar ao pessoal de campo.
2. Com o email e a senha recebidos, o usuário entra no Pilar Campo **daquela obra**,
   numa UI mobile-first enxuta (sem a navegação do app de escritório), e troca a
   senha no primeiro acesso.
3. No Pilar Campo o usuário registra o **dia**: data, clima, efetivo, e marca as
   **tarefas do cronograma** que andaram (reusa `obra_rdo` + `obra_rdo_tarefa` da
   spec 040), com `avançou/concluiu/parou` + observação.
4. O usuário anexa **uma ou mais fotos** ao registro do dia (câmera do celular).
5. O usuário informa **medição** simples por tarefa (quantidade + unidade) quando fizer sentido.
6. **Offline:** registrar o dia, marcar tarefas e tirar foto **funcionam sem rede**;
   ficam numa fila local e sincronizam automaticamente ao voltar a conexão, com um
   indicador claro de "pendente de envio" vs "enviado".
7. O que o campo envia aparece no diário do escritório (spec 040) e alimenta o
   avanço, com a foto visível.

Não-funcionais:

- **Segurança/RLS:** a sessão de campo só autoriza escrever `obra_rdo`,
  `obra_rdo_tarefa`, fotos e medição **da obra da conta** (`campo_accounts.obra_id`);
  nunca outra obra nem leitura ampla. Senha em bcrypt; revisão de segurança +
  rls-auditor obrigatórios.
- **Fotos (LGPD):** bucket privado por empresa, acesso por URL assinada e expirável;
  não indexar; política de retenção. Sem rosto/pessoa identificável como requisito,
  mas tratar como dado da empresa.
- **Performance mobile:** funciona em 3G ruim; imagens comprimidas no cliente antes
  de subir; PWA com cache do shell para abrir offline.
- **Multi-tenant:** isolamento por `empresa_id` mantido mesmo no acesso por token.

## Critérios de aceite

- [ ] Dado o email/senha de campo da obra X, quando entro no celular, então acesso
      o Pilar Campo da obra X e não consigo ver nem escrever na obra Y.
- [ ] Dado que estou sem rede, quando registro o dia com foto e marco uma tarefa
      como concluída, então tudo fica salvo local como "pendente" sem erro.
- [ ] Dado que a rede volta, quando o app sincroniza, então o registro, a foto e o
      efeito no cronograma (tarefa concluída → avanço) aparecem no escritório.
- [ ] Dado um acesso de campo revogado (`ativo=false`), quando tento logar, então
      o acesso é negado.
- [ ] Caso de borda: mesma tarefa reportada offline em dois dispositivos → o
      servidor concilia sem duplicar o vínculo (unique rdo_id+tarefa_id da 040).
- [ ] Segurança: um token da obra X não escreve em `obra_rdo` da obra Y (RLS).

## Dados e contratos

- Tabela nova `campo_accounts` (id, empresa_id, obra_id, nome, email único,
  senha_hash bcrypt, ativo, must_change_senha, created_by). RLS: gestor da empresa
  gerencia; a conta de campo nunca lê a tabela toda.
- RPC `campo_login(email, senha)` (SECURITY DEFINER, padrão `portal_login`) + edge
  `invite-campo` que gera a senha e devolve em claro uma vez. Sessão de campo com
  claim de `obra_id` para as escritas.
- Fotos: bucket `obra-campo` (privado) + tabela `obra_rdo_foto` (rdo_id, path,
  created_by) OU reuso do padrão de anexos. A definir no plano.
- Medição: coluna/tabela leve ligada a `obra_rdo_tarefa` (quantidade + unidade).
- Reusa `obra_rdo` e `obra_rdo_tarefa` (spec 040) para não duplicar o diário.

## Plano de implementação

Aprovar em plan mode antes de codar. Fases:

1. **Identidade + rota** (segurança-crítica, primeiro): `campo_accounts` + RPC
   `campo_login` + edge `invite-campo` + a rota `/campo` isolada do shell + o botão
   "Criar acesso de campo" na obra. Espelha o portal do cliente; **rls-auditor +
   revisão de segurança fecham a fase antes de seguir.**
2. **Registro online**: UI mobile do dia (reusa o motor da spec 040), sem offline
   ainda. Já entrega valor pro residente.
3. **Foto**: captura + compressão + upload assinado.
4. **Offline**: service worker (shell) + fila de ações (IndexedDB) + sync + indicador.
5. **Medição** por tarefa.

## Decisões e riscos

- **Decidido:** identidade = conta de campo com credencial gerada pelo gestor,
  espelhando o portal do cliente (bcrypt + RPC de login), com escrita escopada à obra.
- **Risco:** reabre decisão enterrada na spec 030 (3ª identidade, LGPD de foto,
  competir com Mobuss/Prevision). Mitigado por credencial gerada (sem self-signup) e
  escopo por obra, mas exige **revisão de segurança dedicada** — é a primeira
  superfície de **escrita** por conta não-Supabase (o portal é read-only).
- **Risco:** offline-first é a parte cara (fila, conflito, service worker). Por isso
  é a fase 4, depois de o valor online já estar de pé.
- **ADR:** conta de campo com escrita escopada é decisão transversal → abrir ADR
  curto na fase 1.
