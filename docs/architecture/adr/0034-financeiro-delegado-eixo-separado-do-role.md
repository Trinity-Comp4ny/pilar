# ADR 0034: Acesso a dinheiro é um eixo separado do papel operacional

**Data:** 2026-08-31
**Status:** Proposed

## Contexto

O [ADR 0029](./0029-acesso-por-role-features-por-usuario-saem.md) (20/08) removeu o
eixo de permissão por usuário (`profiles.features`, JSONB viewer/editor por
módulo) depois de um incidente: os três caminhos de convite gravavam esse JSONB
vazio quando o cargo era admin, e a validação exigia grant explícito até para
admin, travando 3 empresas em produção. A decisão foi "acesso = tem profile na
empresa + a empresa tem o módulo", sem recorte por usuário. O próprio ADR 0029
já previa que esse recorte voltaria a ser pedido, e deixou escrito o caminho:
"entra como RBAC por role (papéis com escopo de módulo), nunca como JSONB por
usuário".

Onze dias depois, um cliente (design partner) pediu exatamente o recorte que
saiu: financeiro restrito por padrão ao admin/sócio, com liberação pontual
para quem opera a área. Levantamento no código confirmou que o modelo atual
não tem onde pendurar esse pedido (o detalhe do levantamento fica na memória
do projeto, não aqui; o repo é público):

- As tabelas do módulo Financeiro decidem acesso por
  `user_has_feature('financeiro', ...)`, que desde o ADR 0029 responde por
  módulo da empresa, não por papel nem por pessoa.
- `can_view_folha()` (criada em 18/08, spec 031, para separar folha do resto
  do financeiro via nível *editor* distinto de *viewer*) perdeu a razão de
  ser: o ADR 0029 fez `user_has_feature` ignorar `p_min_level`, então a
  distinção que a spec 031 pretendia para salário/CPF/PIX não existe mais no
  modelo.
- `projetos.valor_contrato` e `projetos.custo_indireto_pct` (margem) não têm
  recorte próprio: seguem a visibilidade do módulo Projetos, que é de todo
  membro.
- O enum `user_role` já reserva `owner`/`coordenador`/`colaborador` desde
  15/08 (spec 031) com o comentário explícito "escondem financeiro/folha da
  equipe", mas o mecanismo que ia ligá-los a alguma regra (`accessPresets.ts`,
  presets no admin portal escrevendo em `profiles.features`) nunca foi
  implementado, e a coluna que ele ia usar foi removida 8 dias depois pelo
  próprio ADR 0029. Hoje são enum morto: a migration de 18/08 já rebaixa
  qualquer `owner`/`colaborador` residual para `admin`/`user`.

Opções consideradas:

- **Reviver `profiles.features` (JSONB por usuário).** Rejeitada: é a causa
  raiz do incidente do ADR 0029. Validação em subset, cascata de revogação,
  três caminhos de escrita (convite, admin, signup) que já divergiram uma vez
  não convergem sozinhos.
- **Um único papel a mais no eixo de role** (ex.: reviver `financeiro` como
  papel de contrato). Rejeitada: conflita hierarquia (quem gerencia o quê) com
  sigilo (quem vê dinheiro). Um coordenador de projeto e um analista júnior
  podem precisar do mesmo acesso financeiro por motivos totalmente diferentes;
  forçar os dois a compartilhar um papel de contrato quebra o resto do
  `canDo()` que já usa role para hierarquia (admin-only routes, convites,
  billing).
- **Dois eixos independentes: papel operacional + concessão financeira**
  (escolhida). Papel (`user`/`coordenador`/`admin`/`ultra_admin`) decide
  hierarquia e continua vivendo em `profiles.role`, sem JSONB. Concessão
  financeira é uma coluna boolean única, sem validação cruzada, sem cascata,
  gate-first no admin (nunca o inverso).

## Decisão

**1. Papel operacional simplificado a três níveis vivos + plataforma.**
`profiles.role` continua sendo a única autoridade de hierarquia:
`user` (execução, só a própria tarefa/projeto atribuído) → `coordenador`
(gerencia projeto/obra, equipe do projeto, prazo) → `admin` (dono do acesso da
empresa, vê tudo) → `ultra_admin` (plataforma, cross-tenant, você). O enum
`owner`/`colaborador`/`financeiro`/`marketing`/`operacional`/`editor`/`viewer`
seguem deprecados-em-lugar (não removidos do enum Postgres, apenas sem
consumidor); `coordenador` é reaproveitado com semântica nova e agora real.
As RPCs de atribuição (`update_user_access`, `set_access_profile`) passam a
aceitar somente os três papéis vivos: hoje ainda deixam cunhar `owner` e
`colaborador`, que não passam em `has_role('admin')` e ficariam fora do gate
novo.

**2. Concessão financeira é um eixo à parte, nunca implícito no papel.**
Nova coluna `profiles.financeiro_delegado boolean not null default false`.
Nem `coordenador` nem `user` veem Financeiro por padrão: mesmo coordenador
precisa do grant explícito, marcado pelo admin por pessoa. Um boolean único,
sem JSONB, sem trigger de validação de subconjunto, sem cascata de revogação:
a forma mais simples que resolve o problema, de propósito, para não reabrir a
superfície que causou o incidente do ADR 0029.

A coluna tem um único caminho de escrita: a RPC `set_financeiro_delegado`
(admin, escopo da própria empresa, auditada). O privilégio de UPDATE da
coluna é revogado de `authenticated` e `tg_prevent_profile_tampering` bloqueia
a alteração fora desse caminho; sem essa dupla barreira, o usuário se
autoconcederia o flag num UPDATE do próprio profile.

**3. Dois níveis de sigilo dentro do eixo financeiro.**

- **Financeiro geral** (contas a pagar/receber, faturas, lançamentos, valor de
  contrato e margem em projeto/obra): `has_role('admin') OR
  financeiro_delegado`. `has_role()` já dá bypass a `ultra_admin` por
  definição.
- **Folha e PII** (salário, CPF completo, chave PIX, conta bancária): só
  `has_role('admin')`. Sem bypass por `financeiro_delegado`, nunca. Restaura a
  intenção original de `can_view_folha()` (spec 031) que o ADR 0029 anulou de
  efeito colateral.

**4. Admin nunca depende do flag.** Toda policy e toda função usa
`has_role('admin') OR <flag>`, nesta ordem, para que um flag ausente, nulo ou
mal escrito nunca tire acesso de quem já deveria ter. É a lição direta do
incidente: o bug de agosto foi provisionamento que dependia de um grant
explícito existir; aqui o grant é aditivo, nunca condição única para o papel
que já manda.

**5. Dinheiro embutido em telas não-financeiras é mascarado por coluna, não
por linha.** Segue o padrão que `pessoas_safe` já validou em produção: uma
view (`security_barrier`, roda com privilégio do dono, replica o predicado de
tenant no `WHERE`) devolve a linha inteira com as colunas monetárias como
`NULL` para quem não tem o grant. `projetos_safe` cobre `valor_contrato` e
`custo_indireto_pct`. `propostas.valor_proposto` e `marcos_faturamento.valor`
ficam FORA do primeiro corte por decisão de produto (quem opera proposta e
faturamento precisa do valor para trabalhar); o padrão fica pronto para
estender se o cliente pedir (ver SPEC 073, "Fora de escopo").

```sql
-- Financeiro geral: bypass de admin sempre primeiro, nunca condição única.
CREATE OR REPLACE FUNCTION public.can_view_financeiro()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role('admin')
    OR COALESCE((SELECT financeiro_delegado FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

-- Folha/PII: sem delegação, nunca.
CREATE OR REPLACE FUNCTION public.can_view_folha()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role('admin');
$$;
```

## Consequências

**Positivas:**

- Entrega o recorte que o cliente pediu (folha e PII só admin; financeiro
  geral por concessão) sem reabrir a classe de bug do ADR 0029: admin nunca
  depende do flag, e o flag é um boolean sem validação cruzada.
- Papel e sigilo financeiro deixam de competir pelo mesmo campo. Hierarquia
  operacional (spec 031: user/coordenador/admin) evolui sem precisar mexer em
  quem vê dinheiro, e vice-versa.
- Reaproveita `coordenador`, que já existia no enum com essa intenção exata
  desde 15/08, em vez de inventar papel novo.
- Reaplica um padrão já testado em produção (`pessoas_safe`) para
  `projetos_safe`, em vez de desenhar mascaramento de coluna do zero.

**Negativas:**

- Superfície de migration não é pequena: todas as policies de RLS que gateiam
  por `user_has_feature('financeiro', ...)` (mais de 20 ocorrências entre
  USING e WITH CHECK), 2 funções (`can_view_financeiro`, `can_view_folha`),
  1 view nova (`projetos_safe`), RPCs do agente de IA e de leitura
  server-side, e o front (`canDo`, rotas, sidebar) precisam da mesma regra.
  Ver [SPEC 073](../../specs/073-financeiro-delegado-e-papel-coordenador.md)
  para o corte em fases.
- `coordenador` deixa de ser cosmético: qualquer lugar do código que hoje trata
  `role` como binário (`admin`/`não-admin`) precisa ser reauditado, porque
  passa a existir um terceiro valor vivo entre `user` e `admin`.
- Novo campo boolean em `profiles` é mais um lugar para o admin esquecer de
  configurar (ex.: convidar alguém que devia ver financeiro e esquecer o
  toggle). Aceito de olhos abertos: convite nasce sempre sem o flag e o admin
  liga depois na tela de usuários (SPEC 073, "Fora de escopo"), porque manter
  um único caminho de concessão vale mais que poupar um clique. É a lição do
  ADR 0029: foi a multiplicação de caminhos de provisionamento que quebrou.

## Decisões relacionadas

- Restaura a parte de `can_view_folha()` do [ADR 0029](./0029-acesso-por-role-features-por-usuario-saem.md)
  que um efeito colateral do próprio ADR anulou; não reabre o eixo por usuário
  que o ADR 0029 removeu (o flag daqui é single-purpose, não um JSONB
  genérico).
- Reaproveita o papel `coordenador` introduzido pelo [SPEC 031](../../specs/031-modelo-de-role-unificado.md)
  / migration `20260715000000_icp_roles_enum.sql`, sem reviver o mecanismo de
  presets sobre `profiles.features` que aquela spec previa e que não sobreviveu
  ao ADR 0029.
- Ver [SPEC 073](../../specs/073-financeiro-delegado-e-papel-coordenador.md).
