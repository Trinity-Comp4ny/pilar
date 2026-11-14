# Kit de cadastro nos diretórios de software

Textos prontos para colar no **Capterra** (que publica também no GetApp e no Software Advice) e na
**B2B Stack**. Cada cadastro vale ponto na nota de SEO ([NOTA_SEO.md](./NOTA_SEO.md)): é um link de outro
site para o Pilar e um lugar para avaliações reais de clientes.

Regras que valem nos dois:

- O nome do produto é **Pilar**, igual ao do site (o Capterra exige o mesmo nome).
- Preço público e honesto: R$ 299, R$ 499 e R$ 899 por mês, por escritório. **Não existe teste grátis**:
  a entrada é por assinatura direta ou por demonstração.
- Só funcionalidades que existem hoje (`apps/marketing/src/lib/modules.ts`). Nada de timesheet,
  rentabilidade por projeto, DRE ou projeção de caixa (módulos dormentes).
- Avaliação só de cliente real. Nunca escrever, comprar ou trocar avaliação por desconto.

## Links de rastreamento

Use estes links no campo "site" de cada diretório. O `utm_source` faz a visita aparecer com o canal certo
no PostHog (evento `landing_cta_clicked`, propriedade `canal`):

| Diretório                           | Link do site                                                             |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Capterra / GetApp / Software Advice | `https://www.pilarsoft.com.br/?utm_source=capterra&utm_medium=diretorio` |
| B2B Stack                           | `https://www.pilarsoft.com.br/?utm_source=b2bstack&utm_medium=diretorio` |

Se o formulário recusar link com parâmetro, use `https://www.pilarsoft.com.br/` puro.

## Dados da empresa

| Campo             | Valor                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Produto           | Pilar                                                                                                                              |
| Site              | ver links acima                                                                                                                    |
| Razão social      | MATHEUS PREZIA REZENDE TECH LTDA                                                                                                   |
| CNPJ              | 63.418.862/0001-59                                                                                                                 |
| Cidade            | Marília, SP, Brasil                                                                                                                |
| Ano de fundação   | _preencher_                                                                                                                        |
| E-mail de contato | _o e-mail comercial que você quer receber leads_                                                                                   |
| Idioma do produto | Português (Brasil)                                                                                                                 |
| Onde roda         | Web (navegador), com app de campo pelo navegador do celular, inclusive sem sinal                                                   |
| Público           | Escritórios de engenharia (civil, estrutural, elétrica, hidráulica, HVAC) e de arquitetura, a partir de 5 pessoas                  |
| Suporte           | E-mail e WhatsApp; migração assistida no plano Profissional; implantação acompanhada no Escala                                     |
| Imagens           | Logo em `brand/assets/logo/`; telas em `apps/marketing/src/assets/showcase/` (`dashboard.webp`, `projeto.webp`, `cronograma.webp`) |

## Categorias

- **Capterra:** Architecture Software, Construction Management Software, Project Management Software.
  Se pedir só uma: **Architecture Software**.
- **B2B Stack:** Gestão de Projetos; ERP (se houver "ERP para serviços" ou "ERP para engenharia", prefira).

## Preço

| Plano        | Preço      | O que muda                                                                                      |
| ------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| Essencial    | R$ 299/mês | Até 10 projetos, 2 obras e 50 leads ativos; 100 créditos de IA por mês                          |
| Profissional | R$ 499/mês | Até 30 projetos, 5 obras e 200 leads ativos; 400 créditos de IA; migração assistida da planilha |
| Escala       | R$ 899/mês | Projetos e leads ilimitados, 15 obras; 1.600 créditos de IA; implantação acompanhada            |

Todos os planos: usuários ilimitados, plataforma inteira (Gestão, Projetos e Obras). Cobrança mensal, sem
fidelidade. Modelo de preço: **assinatura mensal, por escritório (flat rate)**. Teste grátis: **não**.
Versão gratuita: **não**.

## Textos em português (B2B Stack)

**Frase curta (até 100 caracteres)**

> Gestão com agentes de IA para escritórios de engenharia e arquitetura.

**Descrição curta (até 300 caracteres)**

> O Pilar organiza o escritório de projeto do primeiro contato à obra entregue: funil de leads, proposta
> por disciplina, prazo de cada disciplina, financeiro, diário de obra e portal do cliente. Agentes de IA
> preparam o trabalho e a equipe revisa e aprova.

**Descrição completa**

> O Pilar é um sistema de gestão para escritórios de engenharia multidisciplinar e de arquitetura que
> vendem projeto por proposta. Ele junta num lugar só o que hoje fica espalhado entre planilha, WhatsApp e
> e-mail.
>
> **Gestão:** funil de leads, cadastro do cliente pelo CNPJ e proposta montada por disciplina, gerada em
> DOCX no template do escritório. Proposta aprovada vira projeto, com as parcelas do contrato no
> financeiro. Extrato e fatura do cartão são lidos por agente de IA e entram depois da revisão da equipe.
> Folha com comprovante e relatórios do mês.
>
> **Projetos:** quadro com as colunas do escritório, fluxo padrão, mais de um responsável por disciplina e
> Gantt de toda a carteira. Quando a data muda, o sistema pede a justificativa.
>
> **Obra:** diário de obra (RDO) preenchido pelo celular do canteiro, mesmo sem sinal; orçamento de
> fornecedor lido por IA e cotação comparada lado a lado; conta da obra com aporte, despesa com comprovante
> e a taxa de administração do escritório.
>
> **Portal do cliente:** um link só de leitura em que o cliente acompanha disciplinas, entregas, parcelas e
> a prestação de contas da obra, sem criar conta.
>
> A IA prepara, a equipe aprova: nada é executado sem revisão de uma pessoa. Preço por escritório, com
> usuários ilimitados. O Pilar não substitui CAD, BIM ou software de cálculo, e não é ERP de construtora.

**Principais funcionalidades (lista)**

- Funil de leads em quadro
- Proposta por disciplina em DOCX, no template do escritório
- Projeto com disciplinas, responsáveis e Gantt da carteira
- Financeiro: contas, cartões, parcelas do contrato, folha e relatórios
- Extrato e fatura lidos por agente de IA, com revisão da equipe
- Diário de obra pelo celular, funciona sem sinal
- Cotação de material comparada e orçamento de fornecedor lido por IA
- Conta da obra por administração, com prestação de contas
- Portal do cliente só de leitura
- Usuários ilimitados

**Diferenciais (se o formulário pedir)**

1. Feito para escritório de projeto: o projeto é um conjunto de disciplinas com responsável e prazo, não
   uma lista de tarefas.
2. Do lead à obra no mesmo sistema, sem redigitar: proposta aprovada vira projeto e receita.
3. Agentes de IA que preparam o trabalho repetitivo, sempre com a aprovação da equipe.
4. Preço por escritório, sem cobrar por usuário.

## Textos em inglês (Capterra / GetApp / Software Advice)

**Short overview (100 characters)**

> AI-assisted management software for engineering and architecture firms in Brazil.

**Short description**

> Pilar runs a design firm from first contact to project delivery: lead pipeline, discipline-based
> proposals, deadlines per discipline, finance, site diary and a client portal. AI agents prepare the
> routine work and the team reviews and approves it. Built for Brazilian engineering and architecture
> firms; the product is in Portuguese.

**Full description**

> Pilar is management software for multidisciplinary engineering and architecture firms that sell design
> work through proposals. It brings together what usually lives in spreadsheets, WhatsApp and e-mail.
>
> Management: lead pipeline, client data filled in from the company registry (CNPJ), and proposals built by
> discipline and exported to DOCX in the firm's own template. An accepted proposal becomes a project, with
> its contract installments in finance. Bank statements and card bills are read by an AI agent and saved
> after the team reviews them. Payroll with payslips and monthly reports.
>
> Projects: a board with the firm's own columns, a standard workflow, several owners per discipline and a
> Gantt chart of the whole portfolio. Date changes require a reason.
>
> Construction: daily site reports from the phone, offline when there is no signal; supplier quotes read
> by AI and compared side by side; a cost-plus project account with client deposits, expenses with
> receipts and the firm's fee.
>
> Client portal: a read-only link where the client follows disciplines, deliverables, installments and
> the site's spending, without creating an account.
>
> AI prepares, people approve: nothing runs without a team member's review. Flat price per firm with
> unlimited users. Pilar does not replace CAD, BIM or structural analysis tools and is not a contractor ERP.

**Pricing (in the form)**

> Starting price: BRL 299 per month, per firm (flat rate, unlimited users). Plans: BRL 299, BRL 499 and
> BRL 899 per month. Free trial: no. Free version: no.

**Deployment / support / training**

> Deployment: cloud, web browser; field app in the phone's browser. Support: e-mail and WhatsApp.
> Training: guided onboarding and live demo; assisted spreadsheet migration on the
> Professional plan; hands-on implementation on the Scale plan. Languages: Portuguese (Brazil).

## Depois de publicar

1. Anote no [`checklist-externo.json`](./checklist-externo.json): some 1 em `diretorios.quantidade` por
   diretório publicado, ponha o nome em `lista` e a data em `em`.
2. Mande o link do perfil para os clientes ativos pedindo uma avaliação (Capterra ou B2B Stack). Cada
   avaliação publicada entra em `avaliacoes.quantidade`.
3. Rode `npm run seo:nota` (ou peça para o Claude) para ver a nota nova.
