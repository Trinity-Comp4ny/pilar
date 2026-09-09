# SPEC 098: Trial em níveis de confiança (Bronze, Prata, Ouro)

**Data:** 2026-09-08 (v2 no mesmo dia, depois da revisão do CEO)  
**Status:** Em implementação (Fase 0 entregue, ver nota abaixo; Fase 1+ ainda Draft)  
**Autor:** Matheus Rezende (CEO)  
**Módulo:** plataforma (auth, assinatura, tokens, convites, ultra-admin)

## Problema

O Pilar lança comercialmente em outubro/2026 com cadastro self-serve aberto. Hoje uma
conta recém-criada recebe a mesma capacidade de um plano pago (cota de IA, projetos,
usuários) sem que a empresa tenha se identificado além de um e-mail. Isso cria três dores
ao mesmo tempo:

1. **Custo sem compromisso.** IA tem custo variável real e capacidade tem custo de banco;
   ambos são entregues a quem ainda não provou ser um escritório de verdade.
2. **Funil sem degrau.** Não existe nenhum ponto natural entre "criou conta" e "pagou" que
   empurre o trial na direção do pagamento. Ou ele decide sozinho no dia 14, ou some.
3. **Waitlist mata a indicação.** A alternativa óbvia (fechar cadastro e aprovar à mão)
   resolve 1 e 2 e cria uma dor pior: o sócio que chegou por indicação do Bruno (VRZ) e quer
   testar agora não pode esperar aprovação. Esfria e não volta.

Quem sente: o CEO (custo e exposição) e o prospect indicado (fricção). O modelo do gov.br
(bronze, prata, ouro) resolve exatamente essa tensão: entra na hora com o básico, e cada
verificação libera mais.

## Objetivo

Toda conta nova entra **na hora** e chega ao valor central (um projeto com orçamento por
disciplina e margem visível) em minutos; a capacidade sobe conforme a empresa se identifica
(e-mail confirmado, documento, plano ativado), pedida **no momento da necessidade**, e quem
ativa o plano com forma de pagamento converte automaticamente ao fim dos 14 dias.

Medida de sucesso: taxa de conversão trial → pagante e custo de IA por trial, ambos
medidos por nível (ver métricas no fim).

**Fora de escopo:**

- Gate por feature ou módulo. [ADR 0026](../architecture/adr/0026-feature-madura-universal-toggle-vira-capacidade.md)
  fica de pé: tier (e nível) muda **quanto**, nunca **o quê**. Financeiro, Portal, Propostas,
  tudo visível em todo nível.
- Verificação por SMS. Custa, adiciona fricção e chip descartável é barato no Brasil.
  Revisitar só se abuso aparecer nas métricas.
- Verificação externa de CPF. Não existe API pública gratuita; as pagas custam por
  consulta. CPF passa por dígito verificador local e é verificado de forma implícita pelo
  banco e pelo Asaas quando há forma de pagamento.
- Mudança de preço ou de tier. Isso é [PRICING.md](../strategy/PRICING.md).
- Fechar cadastro, waitlist ou convite. Decidido contra em 2026-09-08 (DECISOES.md).

## Níveis (contrato de produto)

| Nível      | Como sobe                                                                           | Projetos ativos    | Obras ativas | Usuários  | IA no trial (tokens) | Portal do cliente | Import em massa | Export |
| ---------- | ----------------------------------------------------------------------------------- | ------------------ | ------------ | --------- | -------------------- | ----------------- | --------------- | ------ |
| **Bronze** | cadastro + e-mail confirmado                                                        | 2                  | 1            | 2         | 50 mil (total)       | não (vitrine)     | não             | sim    |
| **Prata**  | CNPJ verificado ou CPF válido                                                       | 5                  | 2            | 5         | 150 mil (total)      | sim               | sim             | sim    |
| **Ouro**   | plano ativado com forma de pagamento (sem cobrança) **ou** aprovação no ultra-admin | do plano escolhido | do plano     | 10        | cota mensal do plano | sim               | sim             | sim    |
| **Pago**   | fim do trial em Ouro com forma de pagamento (cobrança automática) ou compra direta  | plano              | plano        | ilimitado | plano                | sim               | sim             | sim    |

Regras que valem para a tabela inteira:

- **Os números são hipótese inicial.** Ficam em tabela editável, não em código, e devem ser
  revistos depois dos primeiros 20 trials com telemetria. O erro mais caro é Bronze capado
  demais: se o usuário não sente o valor da tagline no Bronze, o sistema inteiro falha.
- **O trial nasce no plano de entrada (Essencial).** Hoje o trigger cria o trial no plano
  `destaque`; passa a criar no plano de menor preço ativo. O plano só passa a importar no
  Ouro, quando o usuário escolhe explicitamente ao ativar. Evita o choque de testar com
  capacidade de Profissional e pagar Essencial.
- **IA em Bronze e Prata é teto total do trial**, não cota mensal. Subir de nível concede a
  diferença. Ouro passa a usar a cota mensal do plano escolhido, igual a um pagante.
- **Usuários no Ouro: 10 é teto do período de teste**, não do plano. Todo plano pago tem
  usuários ilimitados (PRICING v3); na conversão o teto some.
- **Nível é da empresa, nunca do usuário.** Todo usuário convidado herda o nível da empresa
  e não cria trial próprio.
- **Relógio único:** 14 dias corridos a partir do cadastro, independente do nível.
- **Nunca desce sozinho.** Nível só desce por ação do ultra-admin, com motivo registrado.
- **Projeto exemplo não conta.** Um projeto pré-criado com `exemplo = true` mostra a margem
  funcionando sem consumir a cota; é o caminho mais curto até o valor da tagline.

## Fim do trial e depois

| Situação no dia 14                                | O que acontece                                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ouro com forma de pagamento                       | assinatura vira `active` no plano escolhido, primeira cobrança emitida, recibo por e-mail. Sem nova aprovação: o consentimento foi dado ao ativar (ver requisito 14).                  |
| Ouro por aprovação manual, sem forma de pagamento | mesmo tratamento de Bronze e Prata abaixo.                                                                                                                                             |
| Bronze ou Prata                                   | empresa entra em **somente leitura por 90 dias**: abre, mostra tudo, não cria nem edita, export funciona. Pagar dentro dos 90 dias reativa tudo intacto no mesmo instante.             |
| Dia 60 e dia 85 da leitura                        | e-mail "Seus dados serão excluídos em DD/MM. Exporte ou reative."                                                                                                                      |
| Dia 90                                            | exclusão da empresa e dos dados pessoais pelo fluxo de exclusão já existente. Ultra-admin pode marcar `preservar_dados` (prospect em negociação) para suspender o relógio, com motivo. |

Avisos D-3 e D-1 antes do dia 14 valem para todos os níveis (máquina de e-mail da spec
095/096); para Ouro com forma de pagamento o e-mail traz o valor, a data e um link de um
clique para cancelar. Política de arrependimento: cancelamento em até 7 dias após a primeira
cobrança gera estorno integral. Termos e política de privacidade passam a declarar o prazo
de 90 dias e a finalidade do documento.

## Requisitos

Funcionais:

**Nível e limites**

1. O nível é **derivado de fatos** (e-mail confirmado, documento em `empresas`, forma de
   pagamento no Asaas, override manual), calculado no banco por uma função única
   `nivel_confianca(empresa_id)`. Nunca uma coluna solta que possa divergir do estado real.
2. Os limites por nível vivem na tabela `trial_niveis`, editável no ultra-admin.
3. **Enforcement é server-side.** Criar projeto, obra ou convidar usuário além do limite
   falha no banco (trigger `BEFORE INSERT` ou checagem na edge), com erro tipado que o front
   traduz em convite de desbloqueio. Overlay client-side nunca é a única barreira.
4. **Trial nasce no plano de entrada.** O trigger de criação escolhe o plano ativo de menor
   `preco_mensal`, não o `destaque`.
5. **IA por nível.** `gate_tokens` concede a uma empresa `trialing` a cota do nível
   (`trial_grant:<empresa>:<nivel>`, idempotente), não a cota mensal do plano. Ouro cai no
   ramo do plano.
6. **Circuit breaker de IA.** Gasto agregado de todas as empresas `trialing` num dia acima
   de um teto configurável bloqueia novas chamadas de IA de trials (pagantes não são
   afetados) e notifica o ultra-admin por e-mail e Sentry. Teto em `platform_settings`.

**Entrada e antiabuso**

7. **E-mail confirmado é obrigatório** para qualquer escrita. Confirmação ligada no Supabase
   Auth em staging e produção; login social (Google) já entra confirmado.
8. **Um trial por e-mail confirmado e um por CNPJ.** Domínio de e-mail descartável é
   recusado no signup; a lista vive no banco (`email_dominios_bloqueados`) e é editável no
   ultra-admin. E-mail ou CNPJ que já teve trial não ganha outro; volta só pagando, salvo
   exceção no ultra-admin.
9. **Aviso ao ultra-admin a cada cadastro** (notificação + e-mail) com empresa, e-mail,
   telefone, nível e, quando houver, razão social e CNAE. É o gancho do contato em 24h.

**Prata: documento**

10. **Desbloqueio contextual.** Ao bater um limite, o admin vê o próximo passo exato
    ("Informe o CNPJ para liberar até 5 projetos") com o formulário inline (`FormDialog`).
    Nenhum campo de verificação é pedido adiantado no cadastro; o signup continua com os
    campos de hoje.
11. **CNPJ é verificado na Receita** via BrasilAPI (`/api/cnpj/v1/{cnpj}`), chamada de uma
    edge function, nunca do browser. Regras:
    - situação cadastral `ATIVA` sobe a Prata; `BAIXADA`, `INAPTA` ou `SUSPENSA` recusa com
      mensagem clara;
    - grava `razao_social`, `situacao_cadastral`, `cnae_principal`, `documento_verificado_em`;
    - razão social preenche o nome da empresa se o campo estiver vazio; se divergir do nome
      digitado no cadastro, sobe a Prata mesmo assim e marca alerta no ultra-admin;
    - CNAE não bloqueia nada, só aparece no ultra-admin (7111-1 e 7112-0 são o ICP);
    - BrasilAPI fora do ar: aceita CNPJ com dígito válido como `pendente`, sobe a Prata, e um
      cron reverifica em até 24h. Usuário nunca fica travado por terceiro caído.
12. **CNPJ é único entre empresas.** Informar CNPJ já cadastrado em outra conta recusa com
    "Este CNPJ já tem uma conta no Pilar. Entre com ela ou peça acesso ao administrador."
    Ultra-admin tem a ação "Liberar CNPJ" (a conta que perde o CNPJ volta a Bronze e fica
    marcada) para resolver erro ou má fé.
13. **CPF** (pessoa física) passa por dígito verificador local, sobe a Prata e fica marcado
    no ultra-admin como "sem verificação externa". Finalidade declarada nos termos (LGPD,
    execução de contrato). Grava em `empresas.cnpj` mais `empresas.documento_tipo`.

**Ouro: ativar plano**

14. **O passo se chama "Ativar plano"**, não "cadastrar cartão". O admin escolhe o plano (a
    tela sugere o que cabe no uso real até ali e destaca o Profissional como âncora) e
    informa a forma de pagamento. Copy com data e valor calculados:
    > Nada é cobrado agora. A primeira cobrança de R$ {valor} acontece em {data}, só se
    > você continuar. Cancele antes disso em Configurações, sem cobrança.
    > [ ] Entendo que a cobrança começa em {data} e que posso cancelar antes.
    > O checkbox grava data, valor, plano e versão do texto em `consentimentos_cobranca`. É a
    > evidência do opt-out; **não há nova aprovação no dia 14**.
15. **Tokenização sem cobrança** via Asaas. Se a conta ou o sandbox não suportar, fallback:
    pré-autorização mínima estornada na hora, ou Ouro só por aprovação manual até resolver.
    Quem paga por PIX ou boleto não tem forma de pagamento guardada e chega a Ouro só por
    aprovação manual ou compra direta.
16. **Proteção contra teste de cartão (carding):** Turnstile no formulário, rate limit de
    tentativas de tokenização por empresa e por IP, antifraude do Asaas ligado. Tentativa
    recusada 3 vezes bloqueia o passo por 24h e avisa o ultra-admin.
17. **Trocar de plano durante o trial** é livre e não gera cobrança.
18. **Ouro via ultra-admin:** botão "Liberar trial completo" com motivo, registrado em
    `empresas.nivel_override` e `nivel_override_motivo`. Ultra-admin também pode **estender o
    trial** (edita `trial_ends_at` com motivo) e marcar **preservar dados**.

**Admin, equipe e convites**

19. **Só admin age no nível.** Usuário com papel `user` que bate no limite vê "Sua empresa
    atingiu o limite de {n} {recurso} do período de teste. Peça ao administrador para
    liberar." com botão **"Avisar administrador"**, que cria notificação (central, spec 029)
    e e-mail (spec 096) para os admins com o link do desbloqueio. Nunca mostra formulário de
    documento ou pagamento a quem não é admin.
20. **Convite de usuário funciona em todo nível**, respeitando o teto do nível. A edge
    `invite-user` já exige `admin`, já lê `max_usuarios` e já tem rate limit por empresa;
    passa a ler o teto de `limites_empresa()`. Convidado precisa confirmar e-mail e herda o
    nível da empresa.
21. **Tela de suspensão em duas versões:** admin vê "Reativar" com pagamento e export; user vê
    "Fale com o administrador" com botão de avisar e export.

**Retenção e saída**

22. **Somente leitura por 90 dias** após expirar sem pagar; export sempre disponível; avisos
    no dia 60 e 85; exclusão no dia 90 pelo fluxo existente; `preservar_dados` suspende o
    relógio. Reativar dentro do prazo restaura tudo sem perda.
23. **Termos de uso e política de privacidade** ganham: cláusula de uso restrito (proibido
    criar conta para engenharia reversa, benchmarking comercial ou reprodução do produto sem
    consentimento por escrito), finalidade do documento, prazo de retenção de 90 dias e
    política de arrependimento de 7 dias. Aceite registrado em `terms_acceptances`.

**Contas existentes**

24. **Ninguém que já está dentro cai em Bronze.** Migration marca com `nivel_override =
'ouro'` e motivo `legado` toda empresa criada antes do deploy ou com assinatura `active`
    ou isenta. Design partners (VRZ, CBSP, MF) entram aí.

**Ultra-admin**

25. Aba "Trials": por empresa `trialing` ou em leitura, nível, fatos que o compõem (e-mail,
    documento e verificação, forma de pagamento, override), uso (projetos, obras, usuários,
    tokens, dias restantes), alertas (razão social divergente, CPF sem verificação, breaker
    disparado), e ações: subir/descer nível, liberar CNPJ, estender trial, preservar dados,
    editar `trial_niveis` e `email_dominios_bloqueados`. Lista das últimas 30 recusas de
    signup.

Não-funcionais:

- **Segurança / RLS:** `trial_niveis` e `email_dominios_bloqueados` com leitura para
  autenticado e escrita só ultra-admin. `nivel_override`, `preservar_dados`, campos de
  verificação de documento: só ultra-admin ou a edge de verificação (service role)
  escrevem. `consentimentos_cobranca` é append-only. `nivel_confianca` é `STABLE`,
  `SECURITY INVOKER`, lê só a empresa do chamador (ou qualquer uma se ultra-admin).
- **Performance:** trigger de capacidade conta ativos por empresa; índice em
  `projetos (empresa_id, status)` e equivalentes em obras e membros. `nivel_confianca` são 3
  lookups por chave primária, sem agregação.
- **Multi-tenant:** todo limite é por `empresa_id`. Único agregado global é o circuit
  breaker, por dia, que não vaza nada por empresa. CNPJ único é o único cruzamento entre
  empresas, e só devolve "existe ou não".
- **Terceiros:** BrasilAPI é best-effort com fallback `pendente`; Asaas com fallback
  descrito no requisito 15. Nenhum caminho do usuário depende de terceiro estar de pé.
- **Repo público:** esta spec descreve o alvo. Estado atual das brechas fica na memória do
  projeto, não aqui.

## Critérios de aceite

Entrada e Bronze:

- [ ] Dado um cadastro novo com e-mail confirmado, quando o usuário entra, então existe um
      projeto exemplo com margem visível, ele cria um projeto próprio com orçamento por
      disciplina e vê a margem em menos de 10 minutos, sem pedido de documento ou pagamento.
- [ ] Dado um cadastro novo, então a assinatura nasce `trialing` no plano ativo de menor
      preço, não no `destaque`.
- [ ] Dado um cadastro com e-mail não confirmado, quando tenta criar projeto, então o banco
      recusa e o front mostra "Confirme seu e-mail para começar" com reenvio.
- [ ] Dado um e-mail de domínio bloqueado, quando envia o signup, então a conta não é criada
      e a mensagem diz o que houve e o próximo passo (usar e-mail da empresa).
- [ ] Dado um e-mail que já teve trial, quando tenta novo signup, então é recusado e o front
      oferece recuperar a conta existente.
- [ ] Dado um cadastro novo, então o ultra-admin recebe notificação e e-mail com empresa,
      e-mail, telefone e nível.
- [ ] Dado o projeto exemplo, então ele não conta para o limite de projetos ativos.

Capacidade e desbloqueio:

- [ ] Dado Bronze com 2 projetos ativos (fora o exemplo), quando o admin cria o 3º, então o
      banco falha com `capacidade:projetos` e o front abre o desbloqueio Prata inline.
- [ ] Dado Bronze, quando um `user` tenta criar o 3º projeto, então vê a mensagem de limite
      com "Avisar administrador", e o clique gera notificação e e-mail aos admins com o link
      do desbloqueio; nenhum formulário de documento aparece.
- [ ] Dado um projeto arquivado ou concluído, então ele não conta como ativo.
- [ ] Dado Bronze com 2 usuários, quando o admin convida o 3º, então a edge recusa com
      `capacidade:usuarios` e o front oferece Prata.
- [ ] Dado um usuário sem `auth.uid()` da empresa, quando chama `nivel_confianca` de outra
      empresa, então recebe `permission denied` (pgTAP com papel autenticado, não superuser).

Prata e documento:

- [ ] Dado CNPJ com situação `ATIVA` na BrasilAPI, quando informa, então `nivel_confianca`
      devolve `prata` na mesma transação, a razão social é gravada e o 3º projeto pode ser
      criado sem recarregar a página.
- [ ] Dado CNPJ `BAIXADA` ou `INAPTA`, quando informa, então recusa com mensagem clara e o
      nível não muda.
- [ ] Dado BrasilAPI indisponível e CNPJ com dígito válido, quando informa, então sobe a
      Prata como `pendente` e o cron reverifica em até 24h.
- [ ] Dado CNPJ já usado por outra empresa, quando informa, então recusa com a mensagem de
      conta existente e o ultra-admin vê a tentativa.
- [ ] Dado razão social divergente do nome da empresa, quando informa, então sobe a Prata e
      o ultra-admin vê o alerta.
- [ ] Dado CNPJ ou CPF com dígito inválido, quando envia, então o formulário recusa antes de
      chamar o banco.
- [ ] Dado CPF válido, quando informa, então sobe a Prata e o ultra-admin vê "sem verificação
      externa".
- [ ] Dado ultra-admin, quando usa "Liberar CNPJ", então a empresa que o detinha volta a
      Bronze, fica marcada, e o CNPJ pode ser informado pela outra.

IA:

- [ ] Dado Bronze, quando usa IA, então o saldo parte de 50 mil e o `gate_tokens` recusa
      com 402 ao zerar, sem conceder cota mensal.
- [ ] Dado Bronze que sobe para Prata, então o ledger recebe exatamente a diferença
      (100 mil), uma vez só, mesmo se a RPC for chamada duas vezes.
- [ ] Dado Ouro, então `gate_tokens` cai no ramo do plano escolhido e o comportamento é
      idêntico ao de um pagante.
- [ ] Dado gasto agregado de trials acima do teto diário, quando um trial chama IA, então
      recebe recusa clara ("Uso de IA em contas de teste pausado hoje, volta amanhã") e um
      pagante na mesma hora não é afetado. Ultra-admin recebe e-mail e evento no Sentry.

Ouro, conversão e fim do trial:

- [ ] Dado Prata, quando o admin ativa o plano com forma de pagamento, então nenhuma
      cobrança é emitida, `consentimentos_cobranca` recebe data, valor, plano e versão do
      texto, e `nivel_confianca` devolve `ouro`.
- [ ] Dado o passo "Ativar plano", então a copy mostra a data exata da primeira cobrança e o
      valor do plano escolhido, e o botão só habilita com o checkbox marcado.
- [ ] Dado Ouro com forma de pagamento no dia 14, então a assinatura vira `active`, a
      primeira cobrança é emitida, o recibo é enviado, e o usuário recebeu D-3 e D-1 com link
      de cancelar de um clique. Nenhuma aprovação adicional é pedida.
- [ ] Dado Ouro que troca de plano no dia 10, então nada é cobrado e a data e o valor no
      próximo aviso refletem o plano novo.
- [ ] Dado Ouro com forma de pagamento, quando cancela antes do dia 14, então nada é cobrado
      e a empresa segue o fluxo de Bronze/Prata no vencimento.
- [ ] Dado cancelamento até 7 dias após a primeira cobrança, então o estorno é integral.
- [ ] Dado 3 tentativas recusadas de tokenização, então o passo bloqueia por 24h e o
      ultra-admin é avisado.
- [ ] Dado Bronze ou Prata no dia 14, então a empresa entra em somente leitura: admin vê
      "Reativar" e export; `user` vê "Fale com o administrador", botão de avisar e export.
- [ ] Dado empresa em leitura, quando paga, então volta a `active` com todos os dados.
- [ ] Dado empresa em leitura no dia 60 e no dia 85, então recebe o e-mail de exclusão com
      data; no dia 90 a exclusão roda, salvo `preservar_dados`.
- [ ] Dado ultra-admin, quando estende o trial ou marca preservar, então o motivo fica
      registrado e aparece no histórico da empresa.

Contas existentes e termos:

- [ ] Dado o deploy, então toda empresa criada antes dele, ou `active`, ou isenta, tem
      `nivel_override = 'ouro'` com motivo `legado` e nenhum limite novo se aplica.
- [ ] Dado o texto dos termos em produção, então cláusula de uso restrito, finalidade do
      documento, retenção de 90 dias e arrependimento de 7 dias existem, e o aceite grava a
      versão em `terms_acceptances`.

## Dados e contratos

Tabelas e colunas (migration + `npm run gen:types`):

```sql
create table public.trial_niveis (
  nivel               text primary key check (nivel in ('bronze','prata','ouro')),
  max_projetos        integer,        -- null = do plano
  max_obras           integer,
  max_usuarios        integer,        -- ouro = 10 no trial; pago é ilimitado (plano)
  tokens_total        bigint,         -- null = cota mensal do plano
  portal_habilitado   boolean not null default false,
  import_habilitado   boolean not null default false,
  updated_at          timestamptz not null default now()
);

alter table public.empresas
  add column documento_tipo              text check (documento_tipo in ('cnpj','cpf')),
  add column documento_verificacao       text check (documento_verificacao in ('verificado','pendente','sem_verificacao_externa')),
  add column documento_verificado_em     timestamptz,
  add column razao_social                text,
  add column situacao_cadastral          text,
  add column cnae_principal              text,
  add column nivel_override              text check (nivel_override in ('bronze','prata','ouro')),
  add column nivel_override_motivo       text,
  add column nivel_override_por          uuid references auth.users(id),
  add column nivel_override_em           timestamptz,
  add column preservar_dados             boolean not null default false,
  add column leitura_desde               timestamptz;   -- início dos 90 dias

-- CNPJ único (verificar duplicatas em produção antes de aplicar)
create unique index empresas_cnpj_unico on public.empresas (cnpj)
  where cnpj is not null and deleted_at is null;

alter table public.projetos add column exemplo boolean not null default false;

create table public.consentimentos_cobranca (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  user_id        uuid not null references auth.users(id),
  plan_id        uuid not null references public.pilar_subscription_plans(id),
  valor          numeric(12,2) not null,
  primeira_cobranca_em date not null,
  texto_versao   text not null,
  created_at     timestamptz not null default now()
);   -- append-only, sem update/delete

create table public.email_dominios_bloqueados (
  dominio    text primary key,
  motivo     text,
  created_at timestamptz not null default now()
);

-- platform_settings (ou equivalente): trial_ai_daily_cap_tokens bigint,
-- trial_retencao_dias integer default 90
```

Funções, triggers e edges:

- `nivel_confianca(p_empresa_id uuid) returns text`, `STABLE`, `SECURITY INVOKER`.
  Ordem: `nivel_override` se houver; senão `ouro` se há forma de pagamento tokenizada na
  assinatura; senão `prata` se `empresas.cnpj` preenchido com `documento_verificacao` em
  (`verificado`, `pendente`, `sem_verificacao_externa`); senão `bronze`.
- `limites_empresa(p_empresa_id uuid) returns table (...)`. Se assinatura `active`: limites
  do plano, respeitando `max_projetos_override` / `max_usuarios_override` (spec 052). Se
  `trialing`: `trial_niveis[nivel]`, e para `ouro` projetos/obras/tokens vêm do plano
  escolhido, usuários do `trial_niveis`.
- Trigger `enforce_capacidade_projetos` `BEFORE INSERT` em `projetos` (ignora
  `exemplo = true`) e equivalente em `obras`: conta ativos, compara com `limites_empresa`,
  `raise exception using errcode = 'P0001', message = 'capacidade:projetos', hint = <limite>`.
  Trigger em vez de mexer em `create_projeto_completo`, que tem 3 overloads ativos.
- `invite-user` (edge existente): troca a leitura de `max_usuarios` do plano por
  `limites_empresa()`; erro `capacidade:usuarios`.
- `gate_tokens`: no ramo `trialing`, concede `trial_grant:<empresa>:<nivel>` com
  `tokens_total` do nível menos o já concedido. `DROP` + `CREATE` (overloads).
- Circuit breaker no `gate_tokens` ou função chamada por ele: soma `ai_usage_logs` do dia
  para empresas `trialing`; acima do teto recusa com `trial_ai_pausado`; notifica por `pg_net`.
- Edge `verificar-documento`: recebe CNPJ ou CPF, valida dígito, para CNPJ chama BrasilAPI
  com timeout curto, grava campos de verificação, aplica unicidade, devolve nível novo.
  Cron `reverificar-documentos-pendentes` diário.
- Edge `ativar-plano`: cria/atualiza customer no Asaas, tokeniza forma de pagamento (ou
  fallback), grava `consentimentos_cobranca`, marca a assinatura com forma de pagamento.
  Turnstile e rate limit por empresa e IP.
- `trial-expiry-cron` (existente): para Ouro com forma de pagamento, converte em `active` e
  emite a primeira cobrança; para os demais, marca `leitura_desde`. Novo cron
  `retencao-pos-trial`: avisos no dia 60 e 85, exclusão no dia 90 salvo `preservar_dados`.
- Trigger de criação de trial (`handle_new_user` ou equivalente): plano de menor
  `preco_mensal` ativo; cria o projeto exemplo; notifica ultra-admin.
- Signup: recusa de domínio bloqueado e de e-mail já usado antes de criar `auth.users`.

Front:

- Hook `useNivelConfianca()` devolve `{ nivel, limites, uso, isAdmin }` (uma RPC).
- Componente `DesbloqueioNivel` (`FormDialog`, largura `sm`): para admin, próximo passo
  (documento ou "Ativar plano"); para `user`, mensagem e "Avisar administrador".
- Passo `AtivarPlano` (`FormDialog`, largura `md`): seleção de plano com sugestão, forma de
  pagamento, copy com data e valor, checkbox de consentimento.
- Erro `P0001` com `message` começando por `capacidade:` é interceptado no cliente Supabase e
  roteado para `DesbloqueioNivel` em vez de toast genérico.
- `SubscriptionSuspendedScreen` em duas variantes por papel.
- Portal do cliente no Bronze: tela em modo vitrine com "Disponível ao informar o CNPJ".
- Ultra-admin: aba "Trials" (requisito 25).

## Plano de implementação

Fases em ordem de risco. Fase 0 é bloqueadora do lançamento; as outras podem entrar depois
dele sem quebrar nada.

**Fase 0, antes do lançamento (fecha custo e abuso, sem UI nova), ENTREGUE
(migration `20260920000000_trial_niveis_fase0.sql`, branch
`feat/spec-098-fase-0-trial-niveis`, 24 pgTAP novos, suite completa verde):**

1. `trial_niveis` com seed dos 3 níveis: adiado de propósito pra Fase 1 (sem nível
   Prata/Ouro ainda nesta fase, um teto fixo único bastava pra fechar o custo, feito
   via `platform_settings.trial_tokens_bronze`; essa coluna foi substituída por
   `trial_niveis` assim que a Fase 1 chegou, ver abaixo). `email_dominios_bloqueados`
   com seed de domínios descartáveis: feito. `platform_settings.trial_ai_daily_cap_tokens`:
   feito. Override `ouro`/`legado` pra toda empresa existente antes do deploy
   (requisito 24): feito.
2. Trial nasce no plano ativo de menor preço (Essencial), não mais no destaque
   (Profissional). `handle_new_user` mudou só o `ORDER BY` do SELECT do plano.
3. `gate_tokens` com ramo de teto fixo (não mensal, referência sem mês) pra trial novo
   (status `trialing` e sem `nivel_override`) + circuit breaker diário agregado. pgTAP:
   idempotência, legado mantém cota mensal do plano, pagante não afetado pelo breaker,
   legado não afetado pelo breaker.
4. Confirmação de e-mail: contas existentes marcadas confirmadas no próprio deploy
   (`UPDATE auth.users`); gate de escrita exige e-mail confirmado pra criar projeto
   (sessão `authenticated`; `service_role`/`postgres` passam direto). **Pendente, fora do
   alcance de qualquer migration:** ligar "Confirm email" no Supabase Dashboard (Auth →
   Providers → Email) em staging E produção, já que `db push` não aplica config de
   Auth no servidor. Ação manual do CEO nos dois projetos antes do lançamento.
5. Recusa de domínio de e-mail descartável no signup self-serve (convite/checkout pago
   fora do escopo). **Adiado pra Fase 1** (não bloqueia lançamento): notificação ao
   ultra-admin por cadastro (mecanismo de destinatário cross-tenant ainda não desenhado)
   e "um trial por CNPJ" (não existe CNPJ ainda nesta fase).
6. `gen:types:local` feito. PR pendente de abertura.

**Fase 1, níveis Bronze e Prata (capacidade, documento, equipe), BACKEND ENTREGUE
(migration `20260921000000_trial_niveis_fase1_capacidade_documento.sql`, branch
`feat/spec-098-fase-0-trial-niveis`, Fase 0 e Fase 1 na mesma branch/PR, 32 pgTAP
novos mais 11 Deno test novos, suites inteiras verdes); front (itens 11-12) e ultra-admin
(13) ainda Draft:**

7. ✅ `nivel_confianca`, `limites_empresa`, colunas em `empresas`, `projetos.exemplo`.
   Índice único de CNPJ criado (checagem de duplicata é defensiva: se achar duplicata
   em produção, a migration só avisa e pula, não bloqueia o deploy). pgTAP com papel
   autenticado cobrindo isolamento entre empresas achou e corrigiu um bug real do
   guard (`current_user` dentro de função `SECURITY DEFINER` é sempre o dono da
   função, nunca quem chamou; o teste certo é `auth.role() = 'authenticated'`).
8. ✅ Triggers de capacidade em `projetos` e `obras`; `invite-user` lendo
   `limites_empresa()` (antes só checava `max_usuarios` pra assinatura `active`,
   trial convidava sem teto nenhum). pgTAP: 3º projeto Bronze falha, exemplo e
   Concluído não contam, Prata passa, 2ª obra Bronze falha.
9. ✅ Edge `verificar-documento` com BrasilAPI (dígito verificador local primeiro,
   situação ATIVA sobe/BAIXADA-INAPTA-SUSPENSA recusa/API fora vira `pendente`),
   unicidade (índice do banco, edge traduz a violação em mensagem clara), alerta de
   razão social divergente. Cron `reverificar-documentos-pendentes` diário (agendamento
   manual por ambiente, mesmo padrão do `trial-expiry-cron`). 11 testes Deno cobrindo
   dígito de CNPJ/CPF real, 404, shape-mismatch e rede fora.
10. ✅ Projeto exemplo criado no signup (self-serve), fora da contagem.
11. **Draft.** `useNivelConfianca`, `DesbloqueioNivel` (admin e `user`), "Avisar
    administrador", interceptação de `capacidade:*`, formulário de documento com
    validação de dígito.
12. **Draft.** `SubscriptionSuspendedScreen` em duas variantes; portal em modo
    vitrine no Bronze.
13. Aba "Trials" no ultra-admin (nível, fatos, uso, alertas, ações, edição de tabelas).
14. Telemetria: `trial_limite_atingido`, `trial_nivel_subiu`, `trial_desbloqueio_abandonado`,
    `trial_admin_avisado`.

**Fase 2, Ouro e conversão (depende do Asaas ligado e de titular para receber):**

15. Confirmar no Asaas: tokenização sem cobrança na conta e no sandbox. Registrar aqui.
16. Edge `ativar-plano` com Turnstile, rate limit, `consentimentos_cobranca`; passo
    `AtivarPlano` com sugestão de plano, copy datada e checkbox.
17. `trial-expiry-cron`: conversão automática para Ouro com forma de pagamento, recibo;
    D-3 e D-1 com link de cancelar; troca de plano livre no trial. pgTAP do estado final.
18. Política de arrependimento de 7 dias no fluxo de cancelamento.
19. "Liberar trial completo", "Estender trial" e "Preservar dados" no ultra-admin.

**Fase 3, retenção e acabamento (mecanismo de leitura e de exclusão desenhados em
[ADR 0042](../architecture/adr/0042-somente-leitura-pos-trial-via-trigger-generico.md) e
[ADR 0043](../architecture/adr/0043-exclusao-de-empresa-anonimiza-financeiro-apaga-o-resto.md),
já que a spec pressupunha "fluxo já existente" que não existia; os ADRs registram por que):**

20. `leitura_desde`, modo somente leitura (RLS de escrita bloqueada para empresa em
    leitura), cron `retencao-pos-trial` (avisos 60/85, exclusão 90), `preservar_dados`.
21. Termos e política de privacidade (texto com o advogado): uso restrito, finalidade do
    documento, retenção, arrependimento. Nova versão em `terms_acceptances`.
22. Gate de import em massa por nível (`import_habilitado`), server-side.
23. Revisão dos números da tabela de níveis com os primeiros 20 trials.

Métricas que a spec precisa produzir (PostHog, já instrumentado):

- Funil por nível: Bronze → Prata → Ouro → Pago, com tempo em cada degrau.
- Tempo até o primeiro projeto próprio com margem visível.
- Onde o usuário abandona: qual limite bateu e não desbloqueou; quantos "Avisar
  administrador" viraram desbloqueio.
- Custo de IA por trial por nível; disparos do circuit breaker.
- Signups recusados por domínio, e-mail repetido ou CNPJ duplicado; alertas de razão social
  divergente.
- Conversão no dia 14 por caminho (forma de pagamento vs aprovação manual); cancelamentos
  D-3/D-1; estornos em 7 dias.
- Reativações dentro dos 90 dias; exclusões no dia 90.

## Decisões e riscos

- Decisão de arquitetura: [ADR 0041](../architecture/adr/0041-acesso-no-trial-por-nivel-de-confianca-derivado-de-fatos.md)
  (nível por fatos), [ADR 0042](../architecture/adr/0042-somente-leitura-pos-trial-via-trigger-generico.md)
  (modo leitura), [ADR 0043](../architecture/adr/0043-exclusao-de-empresa-anonimiza-financeiro-apaga-o-resto.md)
  (exclusão no dia 90). Decisão de direção: `DECISOES.md`, 2026-09-08.
- **Risco: Bronze capado demais.** Mitigação: projeto exemplo fora da cota, números em
  tabela, revisão após 20 trials, critério de 10 minutos até a margem.
- **Risco: "Ativar plano" lido como "já estou pagando".** Mitigação: nome do passo, data e
  valor explícitos, checkbox datado, D-3/D-1 com cancelar de um clique, arrependimento de 7
  dias. Se a métrica de abandono nesse passo passar de 50%, revisar a copy antes de mexer no
  mecanismo.
- **Risco: carding no fluxo sem cobrança.** Mitigação no requisito 16. Se o Asaas não
  oferecer antifraude na tokenização, usar pré-autorização estornada.
- **Risco: Asaas sem tokenização sem cobrança.** Fallback no requisito 15. Fase 2 não
  bloqueia o lançamento.
- **Risco: CNPJ informado por quem não é a empresa (squatting).** Raro e barato de resolver:
  alerta de razão social divergente, domínio do e-mail como sinal, "Liberar CNPJ" no
  ultra-admin. Não vale engenharia além disso.
- **Risco: índice único de CNPJ falhar em produção** por duplicatas legadas. Checar antes e
  resolver à mão.
- **Risco: `create_projeto_completo` com 3 overloads.** Trigger evita mexer nela.
- **Risco: e-mail confirmado obrigatório** travar quem já está dentro. Mitigação: marcar
  contas existentes como confirmadas antes de ligar; testar Google OAuth.
- **Risco: retenção de 90 dias curta para ciclo de decisão do escritório.** Mitigação:
  `preservar_dados` no ultra-admin e reativação intacta a qualquer momento dentro do prazo.
  Se as métricas mostrarem reativações tardias, subir para 180.
- **Dependência externa ao escopo:** cobrança automática no dia 14 exige titular para
  receber (CNPJ próprio, conta Asaas, NFS-e), apontado na auditoria de gates de 28/08. Ouro
  com forma de pagamento não vai ao ar antes disso.
- **Suposição a validar com VRZ e CBSP:** o sócio aceita informar CNPJ no 3º projeto e
  ativar plano no 6º. Se recusar, Ouro por aprovação manual vira o padrão e o Prata sobe.
- **Não é proteção contra cópia de UI.** Quem quiser ver as telas vê no Bronze, na landing e
  numa demo. A proteção real é o que roda no servidor (regras, prompts, dados) e a cláusula
  dos termos dá base jurídica. Aceito de olhos abertos.
