# SPEC: Onboarding da empresa, do usuário convidado e da primeira semana

**Data:** 2026-11-07
**Status:** Draft (aguarda as decisões da seção "Decisões em aberto")
**Autor:** Claude, a pedido do Matheus
**Módulo:** onboarding | ultra-admin | configurações | início

## Problema

Quem entra no Pilar hoje cai num sistema vazio, sem saber por onde começar, e o Pilar não sabe
quase nada de quem entrou. O dono preenche nome, telefone e senha, depois só o CNPJ (opcional).
O convidado passa pela mesma tela do dono e cai no `/inicio` sem nenhum guia, porque checklist e
tour são só para admin. O resultado é ativação lenta e base de clientes sem dado para vender,
segmentar a régua de ativação (SPEC 130) ou priorizar produto.

## Como é hoje (levantamento do código, 07/11)

**Entrada da empresa** (único caminho ativo desde a SPEC 133):

1. Ultra-admin › Empresas › "Criar e convidar dono" (`EmpresaDialogs.tsx`): pede **nome da
   empresa** e **e-mail do dono**. A edge `ultra-admin-empresas` já aceita `cnpj` e `owner_nome`,
   mas a tela não manda.
2. Dono abre o e-mail e cai em `/profile-setup` ("Etapa 1 de 2"): nome, sobrenome, telefone
   (obrigatório), senha, termos.
3. `/company-setup` ("Etapa 2 de 2"): nome só leitura e **CNPJ opcional**. Fim.
4. `/inicio` com o checklist flutuante "Primeiros passos" e tours driver.js (SPEC 034, ADR 0018).

**Entrada do usuário convidado:** admin convida por nome, sobrenome, e-mail e tipo de conta
(`InviteDialog`). O convidado vê a mesma `/profile-setup` do dono (sem dizer quem convidou nem
para qual escritório) e vai direto ao `/inicio`, sem checklist e sem tour.

**O que não existe no banco:** site, porte, disciplinas do escritório, função/cargo da pessoa,
LinkedIn, objetivo de uso, origem do cliente.

**Problemas do onboarding guiado atual** (`src/lib/onboarding/steps.ts`):

- **Não tem Propostas**, que é o começo da promessa "Do contrato à execução".
- **Não tem agentes**, que são o primeiro pilar da marca (DECISOES 28/10).
- "Cadastre sua equipe" conta a tabela `pessoas` (RH), não colegas convidados. Convidar um
  colega, o passo que mais segura retenção em SaaS B2B, não está no checklist.
- "Cadastre uma obra" aparece para todo escritório (`obras` é feature universal), mas o ICP é
  escritório de projeto, não construtora.
- 7 passos, nenhum já marcado, ordem igual para todo mundo.
- O "Projeto de exemplo" só existia no self-serve, hoje fechado. Empresa criada pelo ultra-admin
  começa sem nenhum dado de demonstração. E a contagem do checklist não filtra `exemplo=true`.
- Não há tela de boas-vindas no `/inicio`.

## O que o mercado faz (pesquisa, 07/11)

Padrão em Linear, Monday, ClickUp, Asana, Notion, Pipedrive e nos verticais de AEC (Monograph,
BQE Core, Deltek Ajera):

- **Cadastro mínimo, depois 2 a 4 perguntas de 1 tela cada, puláveis**: papel, porte em
  faixas, segmento, "por onde quer começar". O resto é perguntado quando a funcionalidade
  precisa (progressive profiling).
- **Toda pergunta muda alguma coisa no produto.** Se a resposta não é usada, não pergunte.
- **Cargo é o dado que mais rende para personalizar.** Guru teve +71% de ativação com mensagem
  por cargo; Fullstory +14%. O campo livre de "caso de uso" quase ninguém preenche: inferir do
  cargo. (Fontes: casestudies.com/company/candu/case-study/guru-boosts-activation-by-71-with-candu;
  appcues.com/customer-stories/how-fullstory-increased-activation-with-personal-role-based-messages--in-and-out-of-the-app)
- **Formulário:** 3 a 4 campos convertem bem mais que 8+ (5,2% contra 1,9% em tráfego pago,
  saashero.net/google-ppc/landing-page-performance-benchmarks). A HubSpot conclui que pesa mais
  *qual* campo do que quantos.
- **Convidado:** e-mail e escritório já vêm do convite; mostra quem convidou e com qual papel;
  pede só nome, senha e uma pergunta de função. Foto, telefone e LinkedIn ficam para "complete
  seu perfil", nunca bloqueando a entrada.
- **Checklist de 3 a 5 itens, por papel, com 1 ou 2 já marcados** (efeito do progresso
  concedido, Nunes & Drèze 2006). Conclusão média de checklist é só 19% (Userpilot 2024):
  checklist não é ativação, ativação é um evento definido e medido.
- **Dado de exemplo rotulado e removível em um clique.** Pipedrive marca "[Sample]"; Monograph
  dá um sandbox com projetos, equipe e taxas; Ajera tem uma empresa-exemplo recarregável.
- **Empty state educativo** (o que a área faz, uma ação, prévia de como fica cheia) e **tour
  curto e contextual**, nunca um tour de 10 passos no login.
- **Anti-padrões:** pedir CNPJ, telefone ou endereço antes de mostrar o produto; repetir para o
  convidado perguntas da empresa; obrigar a convidar colegas antes do primeiro valor.

**Particularidade do Pilar:** toda empresa entra **depois de uma demonstração** (DECISOES
06/11). O Matheus já conhece o escritório antes de convidar. Então boa parte do dado de "lead"
deve ser preenchida **pelo ultra-admin na criação**, e o dono só confirma. Isso tira atrito do
cliente e garante o dado.

## Objetivo

Todo escritório novo chega ao primeiro valor (proposta ou projeto real com cliente, e um colega
dentro) em até 7 dias, e o Pilar passa a saber, de toda empresa e todo usuário, quem é, quanto
pesa e o que veio fazer.

**Evento de ativação (proposta):** em até 7 dias da criação, a empresa tem 1 cliente,
1 proposta **ou** projeto real (`exemplo=false`) e pelo menos 2 usuários ativos.

**Fora de escopo:** reabrir o self-serve; login com Google para convidado (já existe); SSO;
importação por planilha (vira SPEC própria se a régua mostrar que é o gargalo); sincronizar com
CRM externo (fase opcional no fim).

## Requisitos

### Fase 1 · Criação da empresa pelo ultra-admin (dado de lead na origem)

1. O diálogo "Criar e convidar dono" passa a ter, além de nome e e-mail:
   - **Nome do dono** (opcional; já aceito pela edge, preenche o convite e o perfil).
   - **Site do escritório** (opcional).
   - **CNPJ** (opcional; a edge já aceita).
   - **Disciplinas** (multi-seleção: Arquitetura, Estrutural, Instalações/MEP, Civil e
     infraestrutura, Geotecnia, Outra).
   - **Porte** (1 a 5, 6 a 15, 16 a 40, mais de 40 pessoas).
   - **Origem** (Indicação, LinkedIn, Instagram, Google, Evento, Outro).
2. Tudo opcional, para não travar quem cria rápido; o que ficar vazio o dono preenche na
   entrada.
3. O e-mail do convite passa a citar o nome do dono, quando informado.

### Fase 2 · Entrada do dono (admin da empresa)

Três telas curtas, com barra "Etapa N de 3", cada uma com no máximo 4 campos.

**Etapa 1 · Seu perfil** (`/profile-setup`):

4. Nome e sobrenome (pré-preenchidos do convite), senha, termos. Igual a hoje.
5. **Sua função no escritório** (obrigatório, escolha única em botões): Sócio ou diretor;
   Coordenador de projetos; Engenheiro, arquiteto ou projetista; Financeiro ou administrativo;
   Outra.
6. **Celular / WhatsApp** obrigatório para o dono (a régua da SPEC 130 fala por WhatsApp).
7. **LinkedIn** opcional, com texto de apoio "Opcional".

**Etapa 2 · Seu escritório** (`/company-setup`):

8. Nome (editável, pré-preenchido).
9. **CNPJ** opcional; ao digitar um CNPJ válido, consulta a Receita pela mesma base da edge
   `verificar-documento` e mostra razão social e cidade/UF para confirmar. CNPJ confirmado aqui
   conta para a verificação do nível Prata (SPEC 098), sem pedir de novo depois.
10. **Site** opcional; se vazio, sugere o domínio do e-mail do dono (exceto domínios públicos
    como gmail, hotmail, outlook, yahoo, icloud, bol, uol).
11. **Disciplinas** e **Porte**, pré-preenchidos se o ultra-admin informou.

**Etapa 3 · Por onde começar** (nova):

12. Pergunta única: "O que você quer organizar primeiro?" com 4 cartões: Propostas e contratos;
    Projetos e prazos; Financeiro do escritório; Obras que acompanho. A resposta define a ordem
    do checklist (requisito 21) e o cartão de boas-vindas.
13. Logo abaixo, **convidar colegas** opcional: até 5 e-mails com tipo de conta, botão "Pular
    por agora". Usa a mesma edge `invite-user` (limite e rate limit valem).
14. Concluir leva ao `/inicio` com o cartão de boas-vindas (requisito 18).

### Fase 3 · Entrada do usuário convidado

15. `/profile-setup` para convidado mostra no topo: "**Ana Souza** convidou você para o
    **Alfa Engenharia** como **Coordenador**." (dados do convite e do perfil de quem convidou).
16. Campos: nome e sobrenome (pré-preenchidos), senha, termos e **sua função** (mesma lista do
    requisito 5). **Celular e LinkedIn opcionais.** Uma tela só, sem etapa da empresa.
17. O convidado entra no `/inicio` com o cartão de boas-vindas da sua função e um checklist
    curto próprio (requisito 22).

### Fase 4 · Primeira semana dentro do Pilar

**Boas-vindas:**

18. No primeiro acesso, o `/inicio` mostra um cartão "Boas-vindas ao Pilar" no topo, com o
    caminho escolhido no requisito 12 em destaque e outros dois secundários. Dispensável;
    some sozinho quando o checklist termina.

**Escritório de exemplo:**

19. O dono pode **carregar dados de exemplo** (no cartão de boas-vindas e no checklist): um
    cliente, uma proposta aprovada, um projeto com fases, disciplinas e um aditivo, e alguns
    lançamentos. Tudo com `exemplo=true` e rótulo visível "Exemplo".
20. **Remover exemplo** em um clique (só admin), apagando tudo com `exemplo=true` da empresa.
    Dado de exemplo nunca conta para checklist, capacidade do plano, relatórios ou régua.

**Checklist "Primeiros passos" refeito:**

21. **Dono e admin**, 5 itens, ordem definida pelo requisito 12:
    1. Escritório configurado (já vem marcado).
    2. Cadastre um cliente.
    3. Crie uma proposta **ou** abra um projeto (o primeiro da ordem é o que ele escolheu).
    4. Convide um colega (conta convite aceito ou 2º usuário ativo, não `pessoas`).
    5. Veja o agente trabalhar: abra o painel de pendências do agente (SPEC 146).

    Obras entra no lugar do item 3 só se ele escolheu "Obras que acompanho". Equipe (RH),
    fornecedor, fluxo de disciplinas e lançamento saem do checklist e viram dica contextual
    (tour) quando ele abre a tela.
22. **Convidado**, 3 itens: Perfil completo (foto; já marcado se tiver); abra um projeto em que
    você está; conheça o agente. Coordenador ganha "registre um avanço de fase" no lugar do
    segundo.
23. Contagens do checklist filtram `exemplo=false`.

**Completar perfil depois:**

24. Configurações › Conta ganha **função**, **LinkedIn** e foto. Configurações › Empresa ganha
    **site**, **disciplinas** e **porte**. Sem nudge insistente: um item do checklist do
    convidado e só.

### Fase 5 · Medir

25. Eventos de produto novos (`src/lib/eventosProduto.ts`): `onboarding_etapa_concluida`
    (etapa, papel), `onboarding_objetivo_escolhido`, `exemplo_carregado`, `exemplo_removido`,
    `checklist_item_concluido`, `empresa_ativada` (evento do Objetivo).
26. O ultra-admin vê, no detalhe da empresa, os dados de perfil (função do dono, porte,
    disciplinas, origem, site, objetivo) e se a empresa já ativou.
27. A régua da SPEC 130 passa a usar função e objetivo no texto do WhatsApp.

### Fase 6 (opcional) · CRM

28. Enviar empresa e contatos (dono e convidados) ao HubSpot. Só se o Matheus quiser operar
    vendas por lá; antes disso, o detalhe da empresa no ultra-admin basta.

### Não-funcionais

- **RLS:** colunas novas herdam as policies de `empresas` e `profiles` (só a própria empresa
  lê; só admin edita empresa; cada um edita o próprio perfil). Dados de lead visíveis ao
  ultra-admin pelas policies que ele já tem.
- **LGPD:** LinkedIn e celular são dados pessoais opcionais (exceto celular do dono, que é
  contato contratual). Política de privacidade cita a finalidade (relacionamento e suporte).
- **UI:** `FormDialog`, botões `variant="brand"`, chips/segmented do design system, sem cor
  crua. Copy revisada contra `brand/voice-tone.md`.
- **Repo público:** prints de antes e depois só com seed `dev@local.test`.

## Critérios de aceite

- [ ] Dado o ultra-admin criando empresa com disciplinas, porte, site e CNPJ, quando o dono
      abre o `/company-setup`, então esses campos já vêm preenchidos.
- [ ] Dado o dono sem escolher função, quando tenta avançar a etapa 1, então o formulário pede
      a função.
- [ ] Dado um CNPJ válido digitado na etapa 2, então razão social e cidade/UF aparecem para
      confirmar; dado a Receita fora do ar, então o CNPJ salva sem os dados e sem erro.
- [ ] Dado e-mail `joao@alfaeng.com.br` e site vazio, então o site sugerido é `alfaeng.com.br`;
      dado `joao@gmail.com`, então não há sugestão.
- [ ] Dado o dono que escolheu "Propostas e contratos", então o 3º item do checklist é "Crie
      uma proposta" e o cartão de boas-vindas destaca Propostas.
- [ ] Dado o dono que pulou o convite de colegas, então ele entra no `/inicio` normalmente.
- [ ] Dado um convidado, então a tela mostra quem convidou, o escritório e o tipo de conta, e
      celular e LinkedIn não são obrigatórios.
- [ ] Dado um convidado `user`, então ele vê o checklist de 3 itens, não o do admin.
- [ ] Dado dados de exemplo carregados, então o checklist, a capacidade do plano e os relatórios
      não os contam; quando o admin clica "Remover exemplo", então nada com `exemplo=true`
      sobra na empresa.
- [ ] Dado um usuário não admin, então ele não vê "Carregar exemplo" nem "Remover exemplo".
- [ ] Dado uma empresa com cliente, proposta real e 2 usuários ativos em até 7 dias, então o
      evento `empresa_ativada` é gravado uma única vez.

## Dados e contratos

**`empresas`** (migration nova):

- `site text`
- `porte text check (porte in ('1-5','6-15','16-40','40+'))`
- `disciplinas text[]` (valores fechados, checados por constraint)
- `origem text` (só ultra-admin escreve)
- `objetivo_inicial text check (in ('propostas','projetos','financeiro','obras'))`
- `ativada_em timestamptz`

**`profiles`:**

- `funcao text check (in ('socio','coordenador','tecnico','financeiro','outra'))`
- `linkedin_url text` (valida `linkedin.com/`)

**Dados de exemplo:** coluna `exemplo boolean default false` nas tabelas que o seed toca
(`projetos` já tem; adicionar em `clientes`, `propostas`, `lancamentos` e nas filhas que não
herdam por FK com cascade). RPCs `carregar_exemplo()` e `remover_exemplo()`, SECURITY DEFINER,
checando admin da `empresa_id` de `auth.uid()`.

**Edge `ultra-admin-empresas` POST:** aceita `site`, `porte`, `disciplinas`, `origem` além de
`cnpj` e `owner_nome`.

Depois da migration: `npm run gen:types:local` e commit do `types.ts`.

## Plano de implementação (fatias, um PR cada)

| # | Fatia | Tamanho | Visual? |
|---|---|---|---|
| 1 | Migration (colunas novas) + edge do ultra-admin + diálogo de criação com os campos novos | P | Sim (diálogo) |
| 2 | `/profile-setup` com função, LinkedIn, cabeçalho do convidado e celular opcional para convidado | P | Sim |
| 3 | `/company-setup` com site, disciplinas, porte, CNPJ com consulta; nova etapa "Por onde começar" + convite em lote | M | Sim |
| 4 | Checklist refeito (dono e convidado), filtro `exemplo`, cartão de boas-vindas | M | Sim |
| 5 | Escritório de exemplo (carregar/remover) | M | Sim |
| 6 | Eventos, `empresa_ativada`, painel no ultra-admin, régua da SPEC 130 usando função e objetivo | P | Sim (ultra) |

As fatias 1 a 3 já entregam o dado de lead; 4 e 5 atacam a ativação. Cada PR com antes e depois
(regra do dono).

## Decisões em aberto (para o Matheus)

1. **Celular do convidado:** opcional (recomendado) ou obrigatório como hoje?
2. **Escritório de exemplo:** vale construir (fatia 5) ou o dono deve começar com dado real
   desde o dia 1, já que passou por demonstração?
3. **Obras no onboarding:** sai do checklist padrão e só aparece para quem escolhe "Obras que
   acompanho" (recomendado), ou continua para todos?
4. **"Origem" do cliente:** preenchida só pelo ultra-admin na criação (recomendado, ele sabe da
   demonstração), ou perguntada também ao dono?

## Riscos

- **Mais campos na entrada.** Mitigado: o ultra-admin pré-preenche; cada tela tem até 4
  campos; só função é obrigatória além do que já é hoje.
- **Pergunta que não muda nada.** Cada campo novo tem uso definido: função (checklist,
  boas-vindas, régua), porte e disciplinas (segmentação e priorização), objetivo (ordem do
  checklist), site e LinkedIn (contexto de venda e suporte).
- **Dado de exemplo vazando para relatório ou cobrança.** Mitigado pelo filtro obrigatório e
  por teste de aceite dedicado.
- **Checklist como métrica de vaidade.** A métrica é `empresa_ativada`, não o checklist.
