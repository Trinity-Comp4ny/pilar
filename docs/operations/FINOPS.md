# FinOps: custo de infraestrutura

Quanto a Pilar gasta para rodar, onde está o risco de estourar e o que já segura o gasto.
Revisar uma vez por mês (checklist no fim). ← [voltar](./README.md)

## Retrato em 2026-10-13 (produção)

Este retrato é histórico, não uma fatura atual. As 11 empresas ativas registradas
na época não equivalem automaticamente a 11 assinantes pagantes. Para orçamento
e medição atuais, conferir [Custo por empresa](./CUSTO_POR_EMPRESA.md) e os painéis
dos fornecedores; separar consumo observado de hipóteses de planejamento.

| Fornecedor           | Plano                                    | Consumo medido                                | Limite que importa                                                   | Risco    |
| -------------------- | ---------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Vercel               | Hobby, conta pessoal                     | ver painel (Usage)                            | build e crédito mensais, **dividido com 6 outros projetos pessoais** | **alto** |
| Supabase             | free (prod e staging, mesma organização) | banco 35 MB, storage 6 MB, 11 empresas ativas | 500 MB de banco, 1 GB de storage, pausa por inatividade              | baixo    |
| IA (Gemini, Gateway) | pago por uso                             | US$ 0,01 em 30 dias (8 chamadas, 3 empresas)  | teto por empresa (motor de tokens, SPEC 074)                         | baixo    |
| GitHub Actions       | repo público                             | ilimitado                                     | nenhum enquanto o repo for público                                   | baixo    |
| Sentry               | conferir no painel                       | amostragem de trace e replay só com erro      | cota mensal de eventos                                               | médio    |
| PostHog              | conferir no painel                       | só com consentimento                          | cota mensal de eventos                                               | baixo    |
| Resend               | conferir no painel                       | e-mail transacional                           | cota diária e mensal                                                 | baixo    |
| Asaas                | por transação                            | taxa por cobrança (ADR 0028)                  | sem fixo                                                             | baixo    |

Consumo de banco, storage e IA saiu das consultas abaixo. Vercel, Sentry, PostHog e Resend
não têm API ligada aqui: o número vem do painel de cada um, na revisão mensal.

## O risco real: Vercel

Em 13/10 o crédito da Vercel acabou e o release parou: sem build, sem deploy de produção.
Duas causas, as duas de configuração, não de tráfego:

1. **Prévia para todo PR.** Edge Function, migration, doc e workflow geravam build de
   prévia sem mudar o bundle. Corrigido: `scripts/vercel-ignore.sh` só builda prévia
   quando o commit mexe no que vai para o bundle daquele projeto. Produção sempre builda.
2. **Conta dividida.** `pilar` e `pilar-marketing` dividem o Hobby com `projeto-fe`,
   `projeto-fe-platform`, `xv-nanda`, `saint-jardin`, `inteligencia-imobiliaria` e
   `post-automation`. Um build de projeto pessoal tira crédito do release do Pilar.

**Decisão pendente (dono):** time Vercel próprio para o Pilar (Pro, US$ 20/mês por membro),
ou tirar os projetos pessoais desta conta. O Pro também libera retenção zero no AI Gateway
(ver [SUBPROCESSADORES](../legal/SUBPROCESSADORES.md)) e o uso comercial, que o Hobby não
cobre.

## O que já segura o gasto (no código)

- **Build:** `scripts/vercel-ignore.sh` (prévia só com mudança de bundle).
- **Deploy:** branches `claude/**`, `release/**`, `fix/**` e `dependabot/**` não geram
  deploy nos dois projetos (`git.deploymentEnabled` nos `vercel.json`). O `ignoreCommand`
  pula o build, mas o deploy cancelado já foi criado e conta no limite de 100 por dia do
  Hobby; em 10/11 esse limite estourou só com prévias e barrou o deploy de produção do
  release. `main` e `staging` seguem com deploy. O antes e depois de PR vem de print
  local (regra do `CLAUDE.md`), não do link de prévia.
- **IA:** motor de tokens com teto por empresa e por usuário (SPEC 074, SPEC 094), custo
  estimado gravado por chamada em `ai_token_ledger.custo_estimado`.
- **Sentry:** `tracesSampleRate` por ambiente, rotas públicas descartadas
  (`IGNORED_TX_ROUTES` em `src/lib/monitoring.ts`), replay só em sessão com erro.
- **PostHog:** só com consentimento de cookies.
- **Banco:** backup noturno fora do Supabase (não depende do plano pago, ver
  [DISASTER_RECOVERY](./DISASTER_RECOVERY.md)).

## Custo por empresa

IA, storage, saída de dados, cobranças e atendimento variam com uso e clientes.
A base compartilhada pode permanecer estável dentro de uma faixa, mas isso não
comprova capacidade nem custo constante em qualquer escala. Ver o modelo e a
consulta por modelo/moeda em [Custo por empresa](./CUSTO_POR_EMPRESA.md).

```sql
-- Eventos de uso por empresa e modelo, últimos 30 dias.
-- Não somar modelos/moedas diferentes sem conferir o catálogo vigente.
select l.empresa_id, l.model,
       count(*) as eventos_uso,
       count(*) filter (where l.custo_estimado is null) as eventos_sem_custo,
       sum(l.custo_estimado) as subtotal_conhecido
from public.ai_token_ledger l
where l.created_at >= now() - interval '30 days'
  and l.created_at < now()
  and l.source = 'usage'
group by l.empresa_id, l.model
order by subtotal_conhecido desc nulls last;

-- Banco e storage totais
select pg_size_pretty(pg_database_size(current_database())) as banco;
select bucket_id, pg_size_pretty(sum((metadata->>'size')::bigint)) as tamanho
from storage.objects group by bucket_id order by sum((metadata->>'size')::bigint) desc;
```

## Quando mudar de plano

| Gatilho                                               | Ação                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Uso comercial e primeiros clientes pagantes           | Conferir Vercel Pro e Supabase Pro; PITR é adicional separado, não incluído no Pro |
| Banco acima de 350 MB ou storage acima de 700 MB      | Supabase Pro antes do teto de 500 MB / 1 GB                                        |
| IA acima de 30% da receita de uma empresa             | rever teto do plano dela no motor de tokens                                        |
| Sentry ou PostHog acima de 80% da cota no meio do mês | baixar amostragem antes de subir de plano                                          |

## Revisão mensal (dia 1)

- [ ] Vercel → Usage: build e crédito do mês, por projeto. Algum projeto pessoal gastando?
- [ ] Com acesso autorizado e ambiente explícito, rodar as consultas de leitura e registrar banco, storage e IA em um novo retrato datado, preservando o histórico.
- [ ] Conferir a moeda do catálogo, os eventos sem custo estimado e a reconciliação com as faturas; custo ausente não é zero.
- [ ] Medir horas de implantação e suporte por empresa; conferir assinantes pagantes separadamente das contas no banco.
- [ ] Sentry, PostHog e Resend: consumo contra a cota.
- [ ] Algum gatilho da tabela "Quando mudar de plano" bateu?
