# ADR 0035: Ledger append-only como fonte única de tokens de IA, com saldo cacheado por trigger

**Data:** 2026-08-31
**Status:** Proposed

## Contexto

O Pilar vai cobrar a camada de IA em tokens (decisão de 2026-08-31 em
`docs/strategy/DECISOES.md`; plano completo em `docs/strategy/MOTOR_DE_TOKENS.md`). Hoje a
contabilidade de uso de IA está espalhada em três lugares que não se falam:

- `ai_usage_logs`: log por chamada, sem `user_id`, sem vínculo com run.
- `ai_usage`: contador agregado mensal por empresa, mantido por RPC (`increment_ai_usage`).
  Essa tabela já foi dropada por engano e o caminho de escrita falhou **em silêncio** por
  meses: o teto mensal não barrava ninguém e nada alertou (migration `20260841000000`
  documenta o incidente).
- `agent_runs.tokens_input/output`: por run, só nos fluxos agênticos.

Nenhuma estrutura suporta saldo, crédito de plano, compra avulsa ou estorno. Para virar
billing, precisamos de: atribuição completa (empresa, usuário, agente), saldo com débito em
cascata (cota do plano primeiro, pacote comprado depois), idempotência contra retry, e
imunidade à classe de bug "contador paralelo dessincroniza sem ninguém ver".

Opções consideradas:

- **Opção A: evoluir os contadores agregados** (`ai_usage` ganha colunas de saldo/compra).
  Prós: menor mudança. Contras: mantém a arquitetura que já causou o incidente (agregado
  mantido à mão por RPC, escrita e leitura desacopladas do fato gerador); sem trilha de
  auditoria por evento; estorno e compra viram gambiarras de UPDATE; sem atribuição por
  usuário sem mais uma tabela.
- **Opção B: ledger puro, saldo = SUM() a cada leitura.** Prós: fonte única, zero cache para
  dessincronizar. Contras: o gate roda em TODA chamada de IA; agregação sobre tabela que só
  cresce coloca latência e custo no hot path, e piora com o sucesso do produto.
- **Opção C: ledger append-only + saldo cacheado mantido por trigger.** Prós: fonte única
  auditável (cada débito, crédito, compra e estorno é uma linha imutável), leitura de gate
  O(1), cache que não pode dessincronizar porque o único escritor é o trigger do próprio
  ledger, na mesma transação. Contras: duas estruturas em vez de uma; exige disciplina de
  "nunca escrever token fora da RPC".

## Decisão

Adotar a **Opção C**:

1. **`ai_token_ledger`** (append-only) é a única fonte de verdade de token. Toda variação
   entra como linha com `source IN ('usage','plan_grant','purchase','adjustment','refund')`,
   `tokens_delta` assinado, `empresa_id`, `user_id`, `agent_key`, `agent_run_id` (quando
   houver), `model`, `custo_estimado` (COGS snapshot no momento do evento, via tabela
   `ai_model_precos` com vigência) e `reference_id` (id externo, ex. pagamento Asaas, com
   unique parcial para idempotência de crédito).
2. **`ai_token_saldo`** (uma linha por empresa: `saldo_plano`, `saldo_comprado`) é cache de
   leitura, mantido **exclusivamente** por trigger `AFTER INSERT` do ledger, na mesma
   transação, com débito em cascata (plano primeiro, comprado depois).
3. **`debitar_tokens(...)`**: RPC `SECURITY DEFINER`, restrita a `service_role`, único
   caminho de escrita de uso. Recebe `idempotency_key` (dedupe de retry) e insere no ledger;
   o trigger cuida do saldo. O gate lê `ai_token_saldo` antes da chamada ao provider e
   **bloqueia a próxima chamada** quando o saldo zera, nunca a corrente (o custo no provider
   já ocorreu; overdraft de uma chamada é aceito).
4. **Breakdowns são views** sobre o ledger (por usuário, por agente, por empresa, por mês).
   Nenhum agregado materializado adicional sem novo ADR.
5. **`ai_usage_logs` e `ai_usage` serão absorvidas**: backfill para o ledger, leitura
   migrada, e só então deprecação. Ordem obrigatória: backfill → migrar leitores → drop.

```sql
-- O invariante central, garantido por transação única:
-- INSERT no ledger e atualização do saldo nunca se separam.
CREATE TRIGGER trg_ledger_atualiza_saldo
  AFTER INSERT ON public.ai_token_ledger
  FOR EACH ROW EXECUTE FUNCTION tg_aplicar_delta_no_saldo();
```

## Consequências

**Positivas:**

- Saldo, extrato, breakdown por usuário/agente e COGS saem da mesma fonte; impossível
  divergirem entre si.
- Compra, estorno e ajuste manual são linhas normais do ledger, não casos especiais.
- Auditoria e disputa de cobrança respondíveis linha a linha ("dia X, agente Y, usuário Z").
- A classe de bug do `increment_ai_usage` (contador paralelo falhando em silêncio) deixa de
  existir estruturalmente.

**Negativas:**

- Disciplina obrigatória: qualquer escrita de token fora de `debitar_tokens`/webhook/cron
  quebra o invariante; entra como regra de revisão de código.
- Ledger cresce sem parar; particionamento ou arquivamento por ano fica como dívida
  consciente para quando o volume exigir (não agora).
- Trigger no hot path de INSERT: custo pequeno e pago de olhos abertos em troca do gate O(1).

## Decisões relacionadas

- [SPEC 074](../../specs/074-motor-de-tokens-ledger-saldo-e-debito.md): primeira fase implementável.
- ADR 0028 (Asaas como gateway): o crédito de compra entra pelo `asaas-webhook` existente.
- `docs/strategy/MOTOR_DE_TOKENS.md`: o programa completo (fases, economia, riscos).
- Migration `20260841000000_recria_ai_usage_teto_mensal.sql`: o incidente que motiva a fonte única.
