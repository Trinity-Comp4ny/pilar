# ADR 0041: Acesso no trial sobe por nível de confiança derivado de fatos, aplicado no banco

**Data:** 2026-09-08  
**Status:** Proposed

## Contexto

O lançamento comercial (outubro/2026) exige decidir o que uma conta nova recebe antes de
pagar. Três opções foram consideradas:

- **Opção A, fechar o cadastro (waitlist, convite, demo antes do acesso).** Prós: filtra
  quem entra, zero exposição a abuso. Contras: o prospect indicado que quer testar na hora
  não consegue; cria trabalho manual de aprovação que não escala; esconde a única métrica
  que falta ao Pilar, conversão trial → pagante. Nenhum player AEC lança 100% aberto, mas
  o filtro deles é humano no funil (demo, sales-led), não bloqueio técnico de cadastro.
- **Opção B, cadastro aberto com trial tudo liberado por 14 dias (estado atual).** Prós:
  fricção zero. Contras: entrega cota de IA e capacidade de plano pago a quem só tem um
  e-mail; nenhum degrau que empurre ao pagamento; vetor de abuso por múltiplas contas.
- **Opção C, cadastro aberto com capacidade que sobe por nível de confiança.** Entra na
  hora com o básico (Bronze), sobe ao informar documento (Prata), sobe ao cadastrar forma
  de pagamento ou ser aprovado (Ouro). Modelo conhecido do brasileiro pelo gov.br.

Restrições que pesaram: [ADR 0026](./0026-feature-madura-universal-toggle-vira-capacidade.md)
proíbe gate por feature (tier muda quanto, não o quê), então a alavanca só pode ser
**capacidade**. O motor de tokens ([ADR 0035](./0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md))
já concede cota por ciclo de forma idempotente, e `pilar_subscription_plans.max_projetos`
já existe (spec 052) mas nunca foi aplicado. O repo é público, então o desenho não pode
depender de segredo.

## Decisão

Adotar a Opção C com sete regras fixas:

1. **Nível é função de fatos, nunca estado guardado.** `nivel_confianca(empresa_id)` calcula
   a partir de: override manual do ultra-admin, forma de pagamento no Asaas, documento
   (CNPJ ou CPF) em `empresas`, e-mail confirmado. Não existe coluna `nivel` que possa
   divergir da realidade. O único estado gravado é o override, com autor, motivo e data.
   O nível é da **empresa**; usuário convidado herda e nunca cria trial próprio. Só `admin`
   age no desbloqueio; `user` avisa o admin.
2. **Limites vivem em tabela (`trial_niveis`), não em código.** Os números são hipótese e
   vão mudar com telemetria; mudar número não pode exigir deploy. Ponto de partida:
   Bronze 2 projetos / 1 obra / 2 usuários / 50 mil tokens; Prata 5 / 2 / 5 / 150 mil;
   Ouro capacidade do plano com 10 usuários no período de teste.
3. **Enforcement no banco, não no cliente.** Capacidade por trigger `BEFORE INSERT`
   (`projetos`, `obras`) e pela edge `invite-user` consultando `limites_empresa()`; IA pelo
   `gate_tokens` com concessão `trial_grant:<empresa>:<nivel>` idempotente; circuit breaker
   diário agregado para contas `trialing`. O front só traduz o erro tipado (`capacidade:*`)
   em convite de desbloqueio. Overlay client-side nunca é a única barreira.
4. **Trial nasce no plano de entrada**, não no `destaque`. O plano só é escolhido de
   verdade no passo "Ativar plano". Evita testar com capacidade de Profissional e pagar
   Essencial.
5. **Documento verificado e único.** CNPJ é conferido na Receita via BrasilAPI (situação
   `ATIVA`), com fallback `pendente` se a API cair, e é único entre empresas (índice
   parcial). CPF passa só por dígito verificador e fica marcado como sem verificação
   externa. Um trial por e-mail e um por CNPJ.
6. **"Ativar plano" libera Ouro e torna o trial opt-out.** Sem cobrança no cadastro; o
   admin escolhe o plano, informa a forma de pagamento e marca um consentimento com data e
   valor da primeira cobrança (`consentimentos_cobranca`, append-only). No dia 14 a
   assinatura vira `active` e cobra, sem nova aprovação, com aviso D-3 e D-1 e arrependimento
   de 7 dias. Quem não quer cartão sobe até Prata sozinho e chega a Ouro por aprovação manual.
7. **Retenção com prazo.** Trial vencido sem pagar fica 90 dias em somente leitura com
   export, avisos no dia 60 e 85, exclusão no dia 90 salvo `preservar_dados` do ultra-admin.
   Reativar dentro do prazo restaura tudo.

```sql
-- Forma da função (ilustrativa; contrato completo na SPEC 098)
create or replace function public.nivel_confianca(p_empresa_id uuid)
returns text language sql stable security invoker as $$
  select coalesce(
    (select e.nivel_override from public.empresas e where e.id = p_empresa_id),
    case
      when exists (select 1 from public.pilar_subscriptions s
                   where s.empresa_id = p_empresa_id and s.forma_pagamento_tokenizada) then 'ouro'
      when exists (select 1 from public.empresas e
                   where e.id = p_empresa_id and e.cnpj is not null) then 'prata'
      else 'bronze'
    end);
$$;
```

O que a decisão **não** faz: não fecha o cadastro, não gateia feature, não exige SMS, não
protege contra cópia de interface (aceito: UI é visível na landing e em demo; a proteção
real é o que roda no servidor mais a cláusula de uso restrito nos termos).

## Consequências

**Positivas:**

- Prospect indicado testa na hora e chega ao valor da tagline sem falar com ninguém;
  abusador e curioso ficam presos a 2 projetos e 50 mil tokens.
- Cada degrau é um momento natural de compromisso (documento, cartão), pedido quando o
  usuário quer mais, não na entrada. Trial opt-out converte historicamente 2 a 3 vezes mais
  que trial sem cartão.
- Reusa o que já existe: `gate_tokens`, `max_projetos`, override por empresa, máquina de
  trial e e-mails de aviso. Nenhum sistema paralelo.
- Nível derivado de fatos elimina a classe inteira de bug "nível diz X mas a empresa é Y".
- Números em tabela permitem calibrar sem deploy.

**Negativas:**

- Trigger de capacidade adiciona uma contagem por insert em `projetos`/`obras`.
  Aceitável com índice em `(empresa_id, status)`; volume é baixo.
- Dependência de dois terceiros (BrasilAPI, Asaas), ambos com fallback que nunca trava o
  usuário; o custo é mais estado para reconciliar (`pendente`, cron de reverificação).
- Fluxo de tokenização sem cobrança é alvo de teste de cartão roubado; exige Turnstile,
  rate limit e antifraude, ou pré-autorização estornada.
- Índice único de CNPJ pode colidir com dado legado em produção; precisa de saneamento
  antes de aplicar.
- Mais um ramo no `gate_tokens`, que já é a função mais sensível do motor de tokens.
  Exige `DROP` + `CREATE` (overloads) e pgTAP de idempotência.
- Confirmação de e-mail obrigatória em produção é mudança de comportamento para contas
  existentes; exige marcar as atuais como confirmadas antes de ligar.
- Se o Asaas não tokenizar sem cobrança, Ouro fica só por aprovação manual até se resolver
  (fallbacks na spec). Isso não bloqueia o lançamento.
- O sócio pode recusar informar CNPJ ou cartão em teste. Se acontecer, o ajuste é subir os
  números do Prata, não voltar à Opção B.

## Decisões relacionadas

- [ADR 0026](./0026-feature-madura-universal-toggle-vira-capacidade.md): por que a alavanca é
  capacidade e não feature.
- [ADR 0035](./0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md): ledger idempotente que a
  concessão por nível reaproveita.
- [SPEC 098](../../specs/098-trial-em-niveis-de-confianca.md): contrato completo, critérios
  de aceite e fases.
- [SPEC 052](../../specs/052-features-universais-por-empresa-capacidade-de-plano.md)
  (capacidade por plano e override por empresa): o enforcement adiado lá é entregue aqui.
- [SPEC 078](../../specs/078-empresa-isenta-conversao-para-pagante.md) (conversão isenta →
  pagante): máquina de estados de trial reaproveitada na conversão automática do Ouro.
- `docs/strategy/DECISOES.md`, 2026-09-08: decisão de direção (cadastro fica aberto).
