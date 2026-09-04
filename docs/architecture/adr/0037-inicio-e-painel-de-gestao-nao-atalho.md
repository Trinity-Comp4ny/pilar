# ADR 0037: `/inicio` é painel de gestão servido por uma RPC agregada, não página de atalho

**Data:** 2026-09-04
**Status:** Accepted

## Contexto

`/inicio` nasceu como porta de entrada: saudação, barra "pergunte aos agentes", radar
de vencimentos, lista dos 5 projetos ativos, calendário. Atalho, não leitura. O pedido
do design partner (Bruno, VRZ, 04/09) e a decisão do CEO no mesmo dia mudam a função
da tela: ela vira o painel que a empresa monitora, inclusive numa TV na parede.

Isso força duas escolhas técnicas que são caras de reverter depois.

**Se dinheiro entra ou não.** Um painel de gestão naturalmente puxa margem, faturamento
e caixa, e é onde o Pilar tem mais vantagem. Mas dinheiro é o único dado da empresa com
acesso restrito por eixo próprio (`financeiro_delegado`, ADR 0034), e a tela é para ficar
numa TV do escritório, vista por estagiário, cliente e visitante. Isso deixa três saídas:
servir bloco financeiro condicionado ao papel, servir mascarado, ou não servir.

**Onde agregar.** O `useDashboardData` de hoje dispara ~12 queries pelo client, traz
linhas e soma em `processors.ts`. Funciona para "o mês atual"; não funciona para o
painel, que precisa de 12 meses de série em cinco eixos.

- **Opção A, manter agregação no client**: zero backend novo, mas transfere milhares
  de linhas por load, mata o modo TV com refresh de 5 min, e coloca regra de negócio
  (o que é "no prazo") em TypeScript de tela, onde cada nova tela reimplementa.
- **Opção B, uma RPC agregada por painel** (`get_painel_gestao`): payload pequeno e
  estável, regra de negócio no banco (uma definição de "no prazo"), permissão validada
  no servidor. Custo: SQL mais difícil de testar e mais um contrato para versionar.
- **Opção C, view materializada por empresa com refresh agendado**: o mais rápido em
  leitura, mas cria janela de dado velho e mais infra (pg_cron por ambiente, que já
  deu problema com os alertas ambient). Prematuro sem nenhum cliente sentindo dor.

**O que é a verdade do prazo.** `projetos.data_previsao` é editável. Se o painel medir
pontualidade contra ela, todo projeto atrasado que teve o prazo empurrado conta como
entregue no prazo, e o indicador que motivou a feature nasce mentindo.

## Decisão

1. `/inicio` é o painel de gestão da empresa. Os blocos de atalho (barra dos agentes,
   radar, calendário) continuam, no rodapé, e não competem com os indicadores.
2. **O painel não expressa nada em dinheiro.** Nenhum bloco exibe receita, custo,
   margem, caixa ou faturamento, e a RPC não seleciona coluna monetária de tabela
   alguma. Onde a medida natural seria dinheiro, o painel usa a medida física
   equivalente: proposta em contagem (não em R$), esforço em horas (não em custo),
   escopo pendente em quantidade e dias de espera (não em valor de aditivo). Dinheiro
   continua no Financeiro, para admin e coordenador com `financeiro_delegado`.
3. Todo dado agregado do painel vem de **uma** RPC `get_painel_gestao`, declarada
   `SECURITY INVOKER STABLE`, como as outras RPCs agregadas do projeto
   (`get_finance_stats`, SPEC 044). O RLS filtra a empresa: quem não pode ler a linha
   não a soma, e não há filtro de `empresa_id` escrito à mão para errar. Opção B.
4. A definição de cada indicador vive no SQL dessa RPC, não em processador de tela.
   Tela nova que precise do mesmo número chama a RPC.
5. Indicador histórico só é publicado se tiver **baseline imutável**. Pontualidade usa
   `projetos.data_previsao_original` (congelada no primeiro salvamento);
   `data_previsao` continua sendo o prazo corrente de trabalho.
6. Modo TV é a mesma fonte com outro layout (`/inicio?tv=1`) e reduz nome de pessoa a
   iniciais por padrão, porque carga e atraso por responsável continuam sendo dado
   sobre gente mesmo sem dinheiro na tela.

```sql
-- Um bloco por chave, já agregado. Sem ramo por permissão financeira:
-- não há bloco de dinheiro a liberar ou esconder.
create or replace function public.get_painel_gestao(
  p_periodo_inicio date,
  p_periodo_fim date
) returns jsonb
language plpgsql security invoker stable set search_path = public as $$
begin
  -- Sem filtro de empresa: o RLS de cada tabela já restringe as linhas ao
  -- tenant do chamador. CTEs por bloco, nenhuma selecionando coluna de dinheiro
  -- (garantido por teste em supabase/tests/painel_gestao.sql).
  -- retorno: jsonb_build_object('ancoras', ..., 'comercial', ...,
  --   'entrega', ..., 'produtividade', ..., 'cobertura', ...)
end $$;
```

## Consequências

**Positivas:**

- Uma definição de "no prazo", "conversão" e "margem" no sistema todo. Painel, agentes
  e relatório não podem discordar entre si.
- Payload pequeno e constante: o modo TV pode dar refresh de 5 min sem custo.
- Vazamento de dado financeiro deixa de ser possível nesta tela: não há coluna
  monetária na consulta, então não há caminho a proteger, nem sob impersonation. Fecha
  por construção a classe de bug que já apareceu com delegação e com o toggle de ocultar
  valores (ADR 0034), em vez de depender de um `case when` correto.
- A tela é a mesma para todo papel: um só caminho de render para testar, e o painel pode
  ir para a TV do escritório sem preparo.
- Indicador de prazo passa a ser confiável, ou não existe.

**Negativas:**

- SQL de agregação é mais difícil de testar que TypeScript. Exige pgTAP para as regras
  de contagem, senão a regra de negócio fica sem rede.
- Mais um contrato JSON para manter em sincronia com `types.ts` (o gate `types-sync`
  cobre a assinatura, não o shape interno do `jsonb`; o shape precisa de Zod na
  fronteira, ADR 0033).
- `data_previsao_original` exige migration com backfill de dado histórico imperfeito:
  para projeto já existente, o melhor que dá é a `data_previsao` atual, e a série
  antiga fica otimista. Fica declarado no painel (`cobertura`).
- `useDashboardData` passa a conviver com o hook do painel até ser absorvido. Dívida
  aceita de olhos abertos, com prazo: absorver na fase 2.
- O sócio perde, nesta tela, a leitura de margem e faturamento que ela naturalmente
  pediria, e continua tendo que abrir o Financeiro para isso. Trade-off aceito em troca
  de uma tela sem ramo de permissão e apta a ficar numa parede.

## Decisões relacionadas

- [ADR 0034](./0034-financeiro-delegado-eixo-separado-do-role.md): quem pode ver
  dinheiro; a RPC do painel é onde essa regra passa a valer no servidor.
- [ADR 0033](./0033-resiliencia-de-integracao-com-api-externa.md): validar shape na
  fronteira, incluindo o `jsonb` desta RPC.
- [ADR 0035](./0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md): a leitura em
  linguagem natural do painel é gerada 1x/dia e persistida, não a cada refresh.
- [ADR 0017](./0017-lancamentos-pagina-server-side.md) e SPEC 044: mesmo
  princípio (soma financeira é server-side), agora estendido ao painel inteiro.
- [SPEC 092](../../specs/092-painel-de-gestao-no-inicio.md): a feature.
