# TODO — Config, Admin e Super-admin

> Backlog de "profissionalismo" do produto, saído da discussão multi-agente de 2026-07-14.
> ← [voltar ao índice](./README.md)

**Origem:** o founder sentiu que o Pilar parece menos profissional que SaaS renomados, começando por
configurações/admin/super-admin. Cinco agentes (UX-QA, Head de Produto, Crítico/Red Team, Engenheiro-ICP,
Intel de Mercado) auditaram código + estratégia. Este arquivo é a lista executável que saiu daí.

## Tese central (consenso dos 5)

O que faz um SaaS parecer profissional não é ter **mais** telas de admin, é **coerência e verdade**. O admin
do Pilar já é grande demais para o estágio (admin com 8 abas, `ultra-admin` com 878 linhas, PRs #70-72 recém
aprofundaram). O problema é o oposto do sentido: sobra superfície incoerente, não falta profundidade.

**Distinção que organiza tudo:**

| Camada | Quem usa | Veredito |
|---|---|---|
| **Admin do cliente** (tenant): dados da empresa, usuários, permissões, integrações, plano | O comprador, no dia 1 | Polir vale a pena — derruba ou fecha venda |
| **Super-admin da plataforma** (todas as empresas) | Só o founder | Prematuro (0 pagantes) — só os 3 itens mínimos |

## Pré-requisito (antes de escrever código) — custo quase zero

- [ ] **Merge staging→main + deploys pendentes.** Faz o produto parecer profissional *em produção* (é o que a
      demo toca). Bugs de dinheiro (quitar antecipado, cartão em dobro, fuso) e edge functions (`invite-user`,
      `asaas-config`, `portal-aprovar-proposta`) estão corrigidos/prontos só na staging. Ver memória
      `project_correctness_bugs_2026-07-13` e `project_cicd_backend`.
- [ ] **Gravar a própria demo de venda de ponta a ponta** (criar empresa → projeto → lançar dinheiro → ver
      lucro). A lista de onde travar/dar vergonha é o backlog real, não a comparação com o concorrente.

---

## Bloco 1 — Subtração (meio dia de dev, resolve ~70% da sensação)

Trabalho de **remover incoerência**, não construir. Todos os 5 agentes concordam neste bloco.

- [ ] 🔴 **Matar o claim falso do Asaas.** `src/pages/admin/tabs/Automacoes.tsx` diz que o Asaas está
      "configurado" enquanto a UI é dormente. Marcar honestamente como "em breve" ou remover.
- [ ] 🔴 **Fundir "Automações" + "Integrações" numa aba só.** São dois nomes para o mesmo assunto com dados
      divergentes. Manter o `AsaasConfigForm` real (`Integracoes.tsx`); descartar a duplicata (`Automacoes.tsx`).
- [ ] 🔴 **Aposentar `/company`.** `src/pages/Company.tsx` (476 linhas) duplica `admin/tabs/Empresa.tsx` +
      `Usuarios.tsx` com outra UI e outro fluxo de convite, e está órfã no menu. Redirecionar para
      `/admin?tab=empresa`. Manter um único gerenciador de usuários (`UsersAccessManager`).
- [ ] 🔴 **Centralizar plano/billing num lugar.** Hoje aparece em 3: `/admin?tab=plano`, `/admin?tab=features`
      e `/billing`. Escolher um destino e unificar o CTA de upgrade
      (`Features.tsx:80` → `/billing` vs `Plano.tsx:60` → dialog comercial).
- [ ] 🟠 **Esconder/rotular todo dead-end "em breve".** `Parametros.tsx` linka para Templates (dormente);
      cards "planejado" espalhados. Varredura na UI navegável inteira: nenhum clique deve cair no vazio.
      Estende para abas dormentes do Financeiro (Projeção, Aging, DRE, Rentabilidade, WIP — ver CLAUDE.md).
- [ ] 🟠 **Guard destrutivo no ultra-admin.** Suspender/cancelar empresa (`ultra-admin/index.tsx:849-870`) é a
      ação mais destrutiva do sistema com a proteção mais fraca (só banner amarelo). Trocar por `ConfirmDialog`
      destrutivo exigindo digitar o nome da empresa (o admin do próprio tenant já faz isso em `Company.tsx`).
- [ ] 🟡 **Unificar `CompanyFeatureToggles`.** Roda em dois modelos opostos: draft+Salvar no admin, PUT
      imediato por clique (+ toast spam, sem undo) no ultra-admin (`ultra-admin/index.tsx:503-509`). Padronizar
      no modelo draft+Salvar.
- [ ] 🟡 **Padronizar estados vazios/loading.** Coexistem skeleton, spinner, texto solto em célula e
      `EmptyState`. Um padrão único; empty state orienta a primeira ação ("Convidar primeiro usuário").
- [ ] 🟡 **Auditoria em linguagem de negócio.** `Auditoria.tsx` mostra nome de tabela cru
      (`marcos_faturamento`) e `JSON.stringify(diff)`. Mapear tabela→rótulo humano e diff → "Campo X: de A para B".
- [ ] 🟡 **Nome único e em PT para o admin.** Título "Admin Portal" (`admin/index.tsx:191`) vs menu "Portal
      Admin" (`AppSidebar.tsx:317`). Um só, em português, sem jargão (ex.: "Administração").

---

## Bloco 2 — O que converte o ICP (aí sim, construir)

As 3 configs de **tenant** que o Engenheiro-ICP exige para assinar. Nenhuma é super-admin.

- [ ] 🔴 **Logo + dados do escritório na proposta/relatório.** É o documento que vai pro cliente dele. Sem
      isso, ele não manda. Inegociável.
- [ ] 🔴 **Perfis de acesso que escondem financeiro/folha da equipe.** Sem isso ele não coloca ninguém no
      sistema. Quer **3 perfis prontos e certos**, não 40 checkboxes granulares:
      - Sócio/Owner: vê tudo (dinheiro, margem, folha)
      - Coordenador: projetos dele, horas, prazo — **sem** margem nem folha
      - Colaborador: só a tarefa dele, lança hora — **sem** dinheiro
- [ ] 🔴 **Disciplinas e categorias financeiras editáveis.** Sem isso o "quanto sobra no projeto" vem errado e
      ele volta pra planilha. Disciplinas do escritório (estrutural, hidrossanitário, PPCI…) e contas reais
      (pró-labore, ART/RRT, terceirizados, software).

**Tolerável faltar no começo (ICP aceita):** integração automática com contador (export Excel/CSV resolve),
numeração de proposta customizável, impostos/moeda configuráveis (o ICP nem quer — é risco do contador).

---

## Super-admin — só os 3 mínimos, congelar o resto

Confirmado por Intel de Mercado + UX-QA. Valem desde o 1º design partner; o resto é overkill com <10 contas.

- [ ] 🟠 **Impersonation segura:** banner visível "Você está vendo como [empresa]" + log de quem/quando/por quê.
      Já existe `ImpersonationContext`; falta o banner e o registro.
- [ ] 🟠 **Suspender/reativar conta** com o guard destrutivo do Bloco 1.
- [ ] 🟠 **Feature flag por empresa** (coluna `features jsonb` na tabela empresa) para liberar módulo dormente
      a um parceiro sem deploy nem expor pra todos.

**NÃO fazer agora (congelar):** dashboard de MRR/churn (SQL resolve), observabilidade multi-tenant, RBAC
dentro do god panel, paginação/virtualização de empresas, API keys públicas, notification matrix, ABAC.

---

## A pergunta desconfortável (Crítico/Red Team)

> Se o próximo prospect nunca vê o super-admin, e não há nem um cliente pagante para administrar, que evidência
> concreta existe de que profundidade de admin está impedindo a primeira venda — e não o medo de sair da tela e
> ir falar com o cliente?

**Risco a não ignorar:** somar superfície de admin multiplica bug surface e vetor de RLS/escalada de privilégio
(ver `project_agent_security_findings`) sobre uma base financeira com ~5% de cobertura de teste. Fechar o que
está pronto (pré-requisito) rende mais percepção de profissionalismo que qualquer feature nova.

---

*Fontes de percepção B2B (Intel de Mercado): separar Account/pessoal de Workspace/org no settings, microcopy
por opção, save pattern consistente, members management com estados claros, danger zone com confirmação por
nome, RBAC hierárquico simples (Owner→Admin→Member→Viewer) sem cair em ABAC. Links completos no transcript da
discussão.*
