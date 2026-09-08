# SPEC 098: Trial em níveis de confiança (Bronze, Prata, Ouro)

**Data:** 2026-09-08  
**Status:** Draft  
**Autor:** Matheus Rezende (CEO)  
**Módulo:** plataforma (auth, assinatura, tokens, ultra-admin)

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
(e-mail confirmado, documento, forma de pagamento), pedida **no momento da necessidade**, e
quem cadastra forma de pagamento converte automaticamente ao fim dos 14 dias.

Medida de sucesso: taxa de conversão trial → pagante e custo de IA por trial, ambos
medidos por nível (ver métricas no fim).

**Fora de escopo:**

- Gate por feature ou módulo. [ADR 0026](../architecture/adr/0026-feature-madura-universal-toggle-vira-capacidade.md)
  fica de pé: tier (e nível) muda **quanto**, nunca **o quê**. Financeiro, Portal, Propostas,
  tudo visível em todo nível.
- Verificação por SMS. Custa, adiciona fricção e chip descartável é barato no Brasil.
  Revisitar só se abuso aparecer nas métricas.
- Mudança de preço ou de tier. Isso é [PRICING.md](../strategy/PRICING.md).
- Fechar cadastro, waitlist ou convite. Decidido contra em 2026-09-08 (DECISOES.md).

## Níveis (contrato de produto)

| Nível      | Como sobe                                                                          | Projetos ativos    | Obras ativas | Usuários  | IA no trial (tokens, total) | Portal do cliente | Import/export em massa |
| ---------- | ---------------------------------------------------------------------------------- | ------------------ | ------------ | --------- | --------------------------- | ----------------- | ---------------------- |
| **Bronze** | cadastro + e-mail confirmado                                                       | 2                  | 1            | 2         | 50 mil                      | não               | não                    |
| **Prata**  | CNPJ ou CPF informado e válido                                                     | 5                  | 2            | 5         | 150 mil                     | sim               | sim                    |
| **Ouro**   | forma de pagamento cadastrada (sem cobrança) **ou** aprovação no ultra-admin       | do plano escolhido | do plano     | ilimitado | cota mensal do plano        | sim               | sim                    |
| **Pago**   | fim do trial em Ouro com forma de pagamento (cobrança automática) ou compra direta | plano              | plano        | ilimitado | plano                       | sim               | sim                    |

Regras que valem para a tabela inteira:

- **Os números são hipótese inicial.** Ficam em tabela editável, não em código, e devem ser
  revistos depois dos primeiros 20 trials com telemetria. O erro mais caro é Bronze capado
  demais: se o usuário não sente o valor da tagline no Bronze, o sistema inteiro falha.
- **IA em Bronze e Prata é teto total do trial**, não cota mensal. Subir de nível concede a
  diferença. Ouro passa a usar a cota mensal do plano escolhido, igual a um pagante.
- **Relógio único:** 14 dias corridos a partir do cadastro, independente do nível.
- **Fim do trial:** Bronze e Prata caem para somente leitura (`SubscriptionSuspendedScreen`
  já existente, com aviso D-3 e D-1 pela máquina de e-mail da spec 095/096). Ouro com forma
  de pagamento vira `active` e cobra o plano escolhido (trial opt-out). Ouro por aprovação
  manual, sem forma de pagamento, segue o fluxo de aviso e suspensão.
- **Nunca desce sozinho.** Nível só desce por ação do ultra-admin, com motivo registrado.

## Requisitos

Funcionais:

1. O nível é **derivado de fatos** (e-mail confirmado, documento em `empresas`, forma de
   pagamento no Asaas, override manual), calculado no banco por uma função única
   `nivel_confianca(empresa_id)`. Nunca uma coluna solta que possa divergir do estado real.
2. Os limites por nível vivem na tabela `trial_niveis`, editável no ultra-admin.
3. **Enforcement é server-side.** Criar projeto, obra ou usuário além do limite falha no
   banco (trigger `BEFORE INSERT`), com erro tipado que o front traduz em convite de
   desbloqueio. Overlay client-side nunca é a única barreira.
4. **IA por nível.** `gate_tokens` concede a uma empresa `trialing` a cota do nível
   (`trial_grant:<empresa>:<nivel>`, idempotente), não a cota mensal do plano. Ouro cai no
   ramo do plano.
5. **Circuit breaker de IA.** Gasto agregado de todas as empresas `trialing` num dia acima
   de um teto configurável bloqueia novas chamadas de IA de trials (pagantes não são
   afetados) e notifica o ultra-admin por e-mail e Sentry. Teto em `platform_settings`.
6. **E-mail confirmado é obrigatório** para qualquer escrita. Confirmação ligada no Supabase
   Auth em staging e produção; login social (Google) já entra confirmado.
7. **Um trial por e-mail confirmado.** Domínio de e-mail descartável é recusado no signup;
   a lista vive no banco (`email_dominios_bloqueados`) e é editável no ultra-admin.
8. **Desbloqueio contextual.** Ao bater um limite, o front mostra o próximo passo exato
   ("Informe o CNPJ para liberar até 5 projetos") com o formulário inline (`FormDialog`).
   Nenhum campo de verificação é pedido adiantado no cadastro; o signup continua com os
   campos de hoje.
9. **Prata aceita CNPJ ou CPF** (validação de dígito verificador), com finalidade declarada
   nos termos (LGPD, execução de contrato). Grava em `empresas.cnpj` mais
   `empresas.documento_tipo` (`cnpj` | `cpf`).
10. **Ouro via Asaas:** tokenizar forma de pagamento sem cobrar. Se o Asaas não suportar
    tokenização sem cobrança, fallback: cobrança mínima estornada, ou Ouro só por aprovação
    manual até a conversão. **Ouro via ultra-admin:** botão "Liberar trial completo" com
    motivo, registrado em `empresas.nivel_override` e `nivel_override_motivo`.
11. **Conversão automática.** No fim do trial, empresa Ouro com forma de pagamento vira
    `active` no plano escolhido e a primeira cobrança é emitida. Reusa a máquina de estados
    de trial e os avisos D-3 / D-1 já existentes (spec 078 e 095/096).
12. **Ultra-admin** vê por empresa `trialing`: nível atual, os fatos que o compõem, uso
    (projetos ativos, tokens gastos, dias restantes), e pode subir ou descer o nível com
    motivo. Lista das últimas 30 recusas de signup por domínio.
13. **Termos de uso** ganham cláusula de uso restrito: proibido criar conta para engenharia
    reversa, benchmarking comercial ou reprodução do produto sem consentimento por escrito.
    Aceite registrado em `terms_acceptances` (já existe). É base jurídica, não barreira
    técnica; a barreira técnica é o nível.

Não-funcionais:

- **Segurança / RLS:** `trial_niveis` leitura para autenticado, escrita só ultra-admin.
  `email_dominios_bloqueados` idem. `nivel_override` só ultra-admin escreve. Função
  `nivel_confianca` é `STABLE`, `SECURITY INVOKER`, lê só a empresa do chamador (ou qualquer
  uma se ultra-admin).
- **Performance:** o trigger de capacidade conta projetos ativos por empresa; garantir índice
  em `projetos (empresa_id, status)` (e equivalentes em obras e membros). `nivel_confianca`
  precisa ser barata: 3 lookups por chave primária, sem agregação.
- **Multi-tenant:** todo limite é por `empresa_id`. Nenhum contador global além do circuit
  breaker, que é agregado por dia e não vaza nada por empresa.
- **Repo público:** esta spec descreve o alvo. Estado atual das brechas fica na memória do
  projeto, não aqui.

## Critérios de aceite

Bronze e entrada:

- [ ] Dado um cadastro novo com e-mail confirmado, quando o usuário entra, então ele cria um
      projeto com orçamento por disciplina e vê a margem em menos de 10 minutos, sem nenhum
      pedido de documento ou pagamento.
- [ ] Dado um cadastro com e-mail ainda não confirmado, quando tenta criar projeto, então o
      banco recusa e o front mostra "Confirme seu e-mail para começar" com reenvio.
- [ ] Dado um e-mail de domínio bloqueado, quando envia o signup, então a conta não é criada
      e a mensagem diz o que houve e o próximo passo (usar e-mail da empresa).
- [ ] Dado um e-mail já usado em trial anterior, quando tenta novo signup, então é recusado
      e o front oferece recuperar a conta existente.

Capacidade e desbloqueio:

- [ ] Dado Bronze com 2 projetos ativos, quando cria o 3º, então o banco falha com erro
      tipado `capacidade:projetos` e o front abre o desbloqueio Prata (CNPJ/CPF) inline.
- [ ] Dado Bronze, quando informa CNPJ válido, então `nivel_confianca` devolve `prata` na
      mesma transação e o 3º projeto pode ser criado sem recarregar a página.
- [ ] Dado CNPJ ou CPF com dígito inválido, quando envia, então o formulário recusa antes de
      chamar o banco.
- [ ] Dado Prata com 5 projetos ativos, quando cria o 6º, então o front oferece Ouro (forma
      de pagamento ou "pedir liberação"), nunca um beco sem saída.
- [ ] Dado um projeto arquivado ou concluído, então ele não conta como ativo para o limite.
- [ ] Dado um usuário sem `auth.uid()` da empresa, quando chama `nivel_confianca` de outra
      empresa, então recebe `permission denied` (pgTAP com papel autenticado, não superuser).

IA:

- [ ] Dado Bronze, quando usa IA, então o saldo parte de 50 mil e o `gate_tokens` recusa
      com 402 ao zerar, sem conceder cota mensal.
- [ ] Dado Bronze que sobe para Prata, então o ledger recebe exatamente a diferença
      (100 mil), uma vez só, mesmo se a RPC for chamada duas vezes (idempotência por
      `reference_id`).
- [ ] Dado Ouro, então `gate_tokens` cai no ramo do plano escolhido e o comportamento é
      idêntico ao de um pagante.
- [ ] Dado gasto agregado de trials acima do teto diário, quando um trial chama IA, então
      recebe recusa clara ("Uso de IA em contas de teste pausado hoje, volta amanhã") e um
      pagante na mesma hora não é afetado. Ultra-admin recebe e-mail e evento no Sentry.

Ouro e conversão:

- [ ] Dado Prata, quando cadastra forma de pagamento no Asaas, então nenhuma cobrança é
      emitida e `nivel_confianca` devolve `ouro`.
- [ ] Dado Ouro com forma de pagamento no dia 14, então a assinatura vira `active`, a
      primeira cobrança é emitida e o usuário recebeu aviso D-3 e D-1.
- [ ] Dado Ouro por aprovação manual sem forma de pagamento no dia 14, então cai em
      suspensão com o mesmo aviso, sem cobrança.
- [ ] Dado ultra-admin, quando libera Ouro com motivo, então o override fica registrado e
      aparece no histórico da empresa.

Termos:

- [ ] Dado o texto dos termos em produção, então a cláusula de uso restrito existe e o aceite
      grava a versão em `terms_acceptances`.

## Dados e contratos

Tabelas e colunas (migration + `npm run gen:types`):

```sql
create table public.trial_niveis (
  nivel               text primary key check (nivel in ('bronze','prata','ouro')),
  max_projetos        integer,        -- null = do plano
  max_obras           integer,
  max_usuarios        integer,
  tokens_total        bigint,         -- null = cota mensal do plano
  portal_habilitado   boolean not null default false,
  export_habilitado   boolean not null default false,
  updated_at          timestamptz not null default now()
);

alter table public.empresas
  add column documento_tipo        text check (documento_tipo in ('cnpj','cpf')),
  add column nivel_override        text check (nivel_override in ('bronze','prata','ouro')),
  add column nivel_override_motivo text,
  add column nivel_override_por    uuid references auth.users(id),
  add column nivel_override_em     timestamptz;

create table public.email_dominios_bloqueados (
  dominio    text primary key,
  motivo     text,
  created_at timestamptz not null default now()
);

-- platform_settings (ou equivalente já existente): trial_ai_daily_cap_tokens bigint
```

Funções e triggers:

- `nivel_confianca(p_empresa_id uuid) returns text`, `STABLE`, `SECURITY INVOKER`.
  Ordem: `nivel_override` se houver; senão `ouro` se há forma de pagamento no Asaas
  (`pilar_subscriptions.asaas_customer_id` com cartão tokenizado, ou flag própria); senão
  `prata` se `empresas.cnpj` preenchido e válido; senão `bronze`.
- `limites_empresa(p_empresa_id uuid) returns table (max_projetos int, max_obras int, max_usuarios int, tokens_total bigint, portal boolean, export boolean)`.
  Se assinatura `active`: limites do plano, respeitando `max_projetos_override` /
  `max_usuarios_override` já existentes (spec 052). Se `trialing`: `trial_niveis[nivel]`,
  e para `ouro` cai nos limites do plano escolhido.
- Trigger `enforce_capacidade_projetos` `BEFORE INSERT` em `projetos` (e equivalentes em
  `obras` e na tabela de membros): conta ativos, compara com `limites_empresa`, e levanta
  `raise exception using errcode = 'P0001', message = 'capacidade:projetos', hint = <limite>`.
  Trigger em vez de mexer em `create_projeto_completo`, que tem 3 overloads ativos.
- `gate_tokens`: no ramo `trialing`, concede `trial_grant:<empresa>:<nivel>` com
  `tokens_total` do nível (menos o que já foi concedido em níveis anteriores). `DROP` +
  `CREATE` por causa dos overloads (regra da casa).
- Circuit breaker dentro do `gate_tokens` ou em função separada chamada por ele: soma
  `ai_usage_logs` do dia para empresas `trialing`; acima do teto, recusa com código próprio
  (`trial_ai_pausado`). Notificação por `pg_net` para a edge de e-mail + Sentry.
- Signup: validação de domínio bloqueado e de e-mail já usado antes de criar `auth.users`
  (na edge function de signup ou no `handle_new_user`, o que for mais barato de testar).

Front:

- Hook `useNivelConfianca()` devolve `{ nivel, limites, uso }` (uma RPC).
- Componente `DesbloqueioNivel` (`FormDialog`, largura `sm`): recebe o motivo do bloqueio e
  mostra o próximo passo (CNPJ/CPF, forma de pagamento, ou "pedir liberação").
- Erro `P0001` com `message` começando por `capacidade:` é interceptado no cliente Supabase e
  roteado para `DesbloqueioNivel` em vez de toast genérico.
- Ultra-admin: aba "Trials" com nível, fatos, uso e ações.

## Plano de implementação

Fases em ordem de risco. Fase 0 é bloqueadora do lançamento; as outras podem entrar depois
dele sem quebrar nada.

**Fase 0, antes do lançamento (fecha custo e abuso, sem UI nova):**

1. Migration: `trial_niveis` com seed dos 3 níveis; `email_dominios_bloqueados` com seed
   inicial; `platform_settings.trial_ai_daily_cap_tokens`.
2. `gate_tokens` com ramo `trial_grant` por nível e circuit breaker. pgTAP: idempotência,
   diferença ao subir de nível, pagante não afetado pelo breaker.
3. Ligar confirmação de e-mail em staging e produção; gate de escrita para e-mail não
   confirmado (RLS ou trigger); testar Google OAuth continua entrando direto.
4. Recusa de domínio bloqueado e de e-mail repetido no signup. pgTAP + teste de UI.
5. `gen:types`, PR para `staging`, validar em staging com 3 contas reais (Bronze puro,
   Bronze que sobe, breaker disparando), depois release.

**Fase 1, níveis Bronze e Prata (capacidade e desbloqueio):**

6. `nivel_confianca`, `limites_empresa`, colunas em `empresas`, índices. pgTAP com papel
   autenticado (não superuser) cobrindo isolamento entre empresas.
7. Triggers de capacidade em `projetos`, `obras`, membros. pgTAP: 3º projeto Bronze falha,
   arquivado não conta, Prata passa.
8. `useNivelConfianca`, `DesbloqueioNivel`, interceptação do erro `capacidade:*`, formulário
   CNPJ/CPF com validação de dígito.
9. Aba "Trials" no ultra-admin (nível, fatos, uso, override com motivo).
10. Telemetria: eventos `trial_limite_atingido`, `trial_nivel_subiu`, `trial_desbloqueio_abandonado`.

**Fase 2, Ouro e conversão (depende do Asaas ligado):**

11. Confirmar com o Asaas: tokenização de cartão sem cobrança. Registrar o resultado aqui.
12. Fluxo "cadastrar forma de pagamento" no `DesbloqueioNivel`; `nivel_confianca` passa a
    reconhecer forma de pagamento.
13. Conversão automática no fim do trial para Ouro com forma de pagamento; reusar a máquina
    de estados de trial (spec 078) e os avisos D-3 / D-1. pgTAP do estado final.
14. Botão "Liberar trial completo" no ultra-admin.

**Fase 3, acabamento:**

15. Cláusula de uso restrito nos termos (texto com o advogado), nova versão em
    `terms_acceptances`.
16. Gate de import/export em massa e portal do cliente por nível (`portal_habilitado`,
    `export_habilitado`), server-side.
17. Revisão dos números da tabela de níveis com os primeiros 20 trials.

Métricas que a spec precisa produzir (PostHog, já instrumentado):

- Funil por nível: Bronze → Prata → Ouro → Pago, com tempo em cada degrau.
- Tempo até o primeiro projeto com margem visível (o valor da tagline).
- Onde o usuário abandona: qual limite bateu e não desbloqueou.
- Custo de IA por trial por nível; disparos do circuit breaker.
- Signups recusados por domínio ou e-mail repetido.

## Decisões e riscos

- Decisão de arquitetura: [ADR 0041](../architecture/adr/0041-acesso-no-trial-por-nivel-de-confianca-derivado-de-fatos.md)
  (nível derivado de fatos, limites em tabela, enforcement no banco, cartão libera Ouro com
  conversão opt-out). Decisão de direção: `DECISOES.md`, 2026-09-08.
- **Risco: Bronze capado demais.** Se 2 projetos e 50 mil tokens não bastam para sentir o
  valor, a conversão cai e o problema parece "o produto não convence" quando é "o trial não
  deixa". Mitigação: números em tabela, revisão após 20 trials, e o critério de aceite de 10
  minutos até a margem.
- **Risco: Asaas sem tokenização sem cobrança.** Fallback descrito no requisito 10. Fase 2
  não bloqueia o lançamento.
- **Risco: `create_projeto_completo` com 3 overloads.** Trigger evita mexer nela. Se algum
  fluxo insere projeto por outro caminho (import, agente), o trigger pega igual.
- **Risco: e-mail confirmado obrigatório em produção** pode travar quem já está dentro com
  e-mail não confirmado. Mitigação: marcar como confirmadas as contas existentes antes de
  ligar, e testar o Google OAuth.
- **Suposição a validar com VRZ e CBSP:** o sócio aceita informar CNPJ no 3º projeto e
  cartão no 6º. Se a resposta for "não coloco cartão em teste", Ouro por aprovação manual
  vira o caminho padrão e o número de projetos do Prata sobe.
- **Não é proteção contra cópia de UI.** Quem quiser ver as telas vê no Bronze, na landing e
  numa demo. A proteção real é o que roda no servidor (regras, prompts, dados) e a
  cláusula dos termos dá base jurídica. Aceito de olhos abertos.
