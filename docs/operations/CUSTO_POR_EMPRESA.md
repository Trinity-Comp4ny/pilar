# Custo por empresa e capacidade de atendimento

Referências públicas conferidas em 13/11/2026. Este documento organiza a medição e
o orçamento da operação comercial. Não é uma medição da produção, uma fatura ou
uma promessa de capacidade. ← [Operações](./README.md) · [FinOps](./FINOPS.md)

## 1. Separar quatro custos

1. **Base compartilhada:** assinatura dos provedores, compute, ambientes,
   monitoramento e backup. Pode ficar estável dentro de uma faixa de uso.
2. **Consumo:** IA por modelo/modalidade, armazenamento, saída de dados, funções,
   e-mails e taxas por cobrança. Cresce conforme o trabalho realizado.
3. **Entrada de clientes:** diagnóstico comercial, configuração, migração,
   treinamento e deslocamento. Medir as horas de cada etapa, inclusive fora das reuniões.
4. **Atendimento recorrente:** dúvidas, investigação de falhas e acompanhamento.
   Registrar horas por empresa. O tempo do fundador tem custo econômico mesmo
   quando não há desembolso adicional naquele mês.

Uma empresa no banco não equivale a um assinante pagante. Contas de teste,
canceladas, gratuitas ou internas não entram automaticamente no MRR.
MRR é receita recorrente mensal contratada, não saldo bancário nem recebimento.
Implantação avulsa e compra de créditos não entram no MRR.

## 2. Referências públicas de fornecedores

| Item                                       | Referência                                                  | Condição                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel Pro                                 | US$20/mês                                                   | Conferir assentos faturáveis, uso excedente, tributos e conta efetiva. Hobby tem restrição a uso pessoal não comercial.                    |
| Supabase Pro                               | A partir de US$25/mês                                       | Uma organização paga inclui US$10 de crédito de compute, suficiente para um Micro.                                                         |
| Segundo projeto Micro na mesma organização | Aproximadamente US$10/mês adicionais                        | O crédito de compute é por organização, não por projeto. Produção e staging devem ser dimensionados separadamente.                         |
| Supabase Storage                           | 100 GB incluídos no Pro; excedente anunciado a US$0,0213/GB | Conferir a cota compartilhada da organização e o consumo no ciclo.                                                                         |
| Supabase egress                            | 250 GB incluídos; excedente não cacheado a US$0,09/GB       | Egress cacheado tem medição e tarifa próprias. Não somar as duas cotas como se fossem intercambiáveis.                                     |
| PITR de 7 dias                             | Aproximadamente US$100/mês por projeto                      | Adicional separado; não está incluído nos US$25 do Pro. Compute e requisitos próprios também se aplicam.                                   |
| Asaas cartão                               | Referência padrão publicada: 2,99% + R$0,49 por cobrança    | A página também anuncia promoção inicial. A taxa válida é a da conta/contrato; considerar antecipação e serviços adicionais separadamente. |

Fontes: [Vercel preços](https://vercel.com/pricing),
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Supabase preços](https://supabase.com/pricing),
[Supabase cobrança por organização](https://supabase.com/docs/guides/platform/billing-on-supabase),
[Supabase compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute),
[Supabase PITR](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery),
[Asaas taxas](https://www.asaas.com/precos-e-taxas).

Uma hipótese de piso é US$20 + US$25 + US$10 = US$55/mês antes de uso excedente,
outros fornecedores e encargos. Com câmbio **hipotético** de R$6/US$, são R$330.
Esse cálculo não confirma os planos contratados pela Pilar nem sua fatura atual.

## 3. Orçamento ilustrativo por tamanho da base

Hipóteses editáveis de planejamento: mix de planos 30% Essencial, 50%
Profissional, 20% Escala, nos preços R$299/R$499/R$899; ticket médio R$519.
Base técnica de R$330 e reserva de R$120 para outros provedores; orçamento de
IA de R$15 por empresa/mês. Reservas adicionais de crescimento, escolhidas para
planejamento e não exigidas pelo provedor, de R$0/R$150/R$450/R$1.050.
Armazenamento médio de 2 GB/empresa e egress não cacheado de 5 GB/empresa/mês,
com as cotas/tarifas da seção anterior e câmbio hipotético de R$6.

| Empresas pagantes | MRR ilustrativo | Orçamento técnico mensal | Suporte a 30 min/empresa/mês |
| ----------------- | --------------: | -----------------------: | ---------------------------: |
| 10                |         R$5.190 |                 R$600,00 |                          5 h |
| 25                |        R$12.975 |                 R$975,00 |                       12,5 h |
| 50                |        R$25.950 |               R$1.650,00 |                         25 h |
| 100               |        R$51.900 |               R$3.147,78 |                         50 h |

Orçamento técnico = base + reservas + IA + excedentes de storage/egress.
Não inclui taxas de cobrança, tributos, aquisição, desenvolvimento, remuneração
do fundador ou equipe, contabilidade, jurídico, estornos e inadimplência.
Não é lucro líquido nem projeção de fluxo de caixa. Uso alto de áudio, modelos
mais caros, mais arquivos e outros serviços podem alterar o orçamento.
Não inferir que uma instância Micro suporta 100 escritórios a partir desta tabela:
isso depende de consultas, concorrência, latência e testes de carga.

## 4. Medir IA sem esconder custos ausentes

`ai_token_ledger` é a trilha de consumo. Selecionar `source = 'usage'` exclui
concessões, compras, ajustes e devoluções de saldo. Esses movimentos não são
chamadas de inferência. Uma linha é um evento de débito, não necessariamente
uma única requisição ao fornecedor.

`custo_estimado` pode ser NULL quando o modelo não tem preço cadastrado. A soma
ignora NULL e pode subestimar o total. Contar esses eventos e exibir cobertura
antes de tomar decisão de margem. Não substituir custo desconhecido por zero.
O catálogo de preços e a moeda são conferidos no mês; preço por token depende
de modelo, modalidade, cache e outras condições. A estimativa não substitui a fatura.

Consulta de leitura para a equipe autorizada de operação, no ambiente
explicitamente selecionado. Os dados de empresas não devem ir para o repo
público, prints de PR ou material de prospecção. Não muda RLS ou permissões.

```sql
-- Últimos 30 dias: mantém modelos/moedas separados e sinaliza cobertura.
with eventos as (
  select l.empresa_id, l.model, l.tokens_input, l.tokens_output,
         l.custo_estimado,
         coalesce(p.moeda, 'NAO_IDENTIFICADA') as moeda
  from public.ai_token_ledger l
  left join lateral (
    select mp.moeda
    from public.ai_model_precos mp
    where mp.modelo = l.model and mp.vigente_desde <= l.created_at
    order by mp.vigente_desde desc
    limit 1
  ) p on true
  where l.source = 'usage'
    and l.created_at >= now() - interval '30 days'
    and l.created_at < now()
)
select empresa_id, model, moeda,
       count(*) as eventos_uso,
       count(*) filter (where custo_estimado is null) as eventos_sem_custo,
       round(100.0 * count(custo_estimado) / count(*), 2) as cobertura_percentual,
       sum(tokens_input) as tokens_input,
       sum(tokens_output) as tokens_output,
       sum(custo_estimado) as subtotal_conhecido,
       case when count(*) filter (where custo_estimado is null) = 0
                  and moeda <> 'NAO_IDENTIFICADA'
            then sum(custo_estimado)
            else null end as total_estimado_completo
from eventos
group by empresa_id, model, moeda
order by subtotal_conhecido desc nulls last;
```

Sem linhas no período significa ausência de eventos registrados nesse recorte.
Não comprova custo zero da conta inteira ou ausência de falhas de instrumentação.
Mesmo cobertura de 100% não comprova que toda chamada faturada passou pelo ledger.
Reconciliar totais por fornecedor/modelo com os respectivos painéis e faturas.
O recorte de 30 dias não coincide necessariamente com o ciclo de cobrança.

## 5. Revisão mensal e decisão de capacidade

- Exportar faturas e consumo por ambiente/provedor e registrar data, moeda e período.
- Medir custo de IA por empresa, distribuição entre clientes e cobertura do ledger.
- Acompanhar tamanho do banco, storage, egress, funções, conexões e latência p95.
- Separar custo de cobrança da assinatura, estornos e antecipação.
- Medir tempo de implantação e atendimento; registrar a causa de trabalho repetido.
- Calcular custo de caixa e custo econômico do atendimento em colunas distintas.
- Revisar reservas quando o uso real justificar; não converter hipótese em medição.

Fórmula de agenda mensal: horas comerciais fixas + clientes ativos × horas de
suporte por cliente + novos clientes × horas médias de entrada.
Exemplo hipotético: 20 h comerciais + 50 clientes × 0,5 h + 3 entradas × 2,375 h
= 52,125 h. Se houver 40 h disponíveis para essas atividades, o processo precisa
de menos trabalho manual ou mais capacidade antes de aumentar as vendas.

Uma ocupação sustentada acima de 80% é um gatilho interno sugerido para revisar
capacidade, não um SLA de atendimento nem uma regra técnica de infraestrutura.
Automação, material de ajuda e treinamento coletivo devem reduzir tarefas
repetidas. A contratação de apoio depende de volume, margem e qualidade do serviço.
