# ADR 0043: Exclusão de empresa no dia 90 anonimiza dados fiscais/financeiros e apaga o resto

**Data:** 2026-09-09
**Status:** Accepted (implementado, PR [#487](https://github.com/Trinity-Comp4ny/pilar/pull/487))

## Contexto

SPEC 098 (requisito 22): trial vencido em somente leitura por 90 dias, sem `preservar_dados`,
é excluído no dia 90 "pelo fluxo de exclusão já existente". Esse fluxo **não existe**. O que
há hoje:

- `data_deletion_requests` + `request_data_deletion()`
  (`supabase/migrations/20260504400000_data_deletion_requests.sql`): pedido de **um usuário**
  (LGPD Art. 18 IV), não de uma empresa inteira. Cria uma linha `pending`; nenhum código
  executa a exclusão de fato, é processo 100% manual do admin, com um `TODO` explícito no
  arquivo pra plugar uma edge function que ainda não existe.
- `delete-user` (edge function): remove **um** `auth.users`, não uma empresa.
- Soft delete (SPEC 060): apaga (marca `deleted_at`) registros dentro de uma empresa, não a
  empresa em si, e é acionado pelo próprio usuário, não por um cron de retenção.

Ou seja, a Fase 3 não está "ligando um fluxo existente", está desenhando um do zero: apagar
de verdade os dados de uma empresa inteira, disparado automaticamente por um cron, sem
intervenção humana no caminho feliz. Isso é irreversível e tem uma restrição legal real, já
registrada nos próprios termos de uso
(`docs/legal/TERMS_OF_SERVICE.md`, seção 5): _"depois disso, os dados são anonimizados ou
eliminados conforme a Política de Privacidade e obrigações legais de retenção (ex.: fiscal,
5 anos)"_. O texto já prevê os dois caminhos (anonimizar vs eliminar), não só um.

- **Opção A, `DELETE` físico de tudo.** Mais simples de implementar (reusa a mesma
  varredura de tabelas do ADR 0042). Viola a obrigação de retenção fiscal de 5 anos que o
  próprio contrato do Pilar já assume perante o cliente: lançamentos, faturas, notas,
  folha de pagamento não podem simplesmente sumir.
- **Opção B, `UPDATE ... SET deleted_at = now()` (soft delete) em tudo, nunca apagar
  de verdade.** Resolve a obrigação fiscal, mas não cumpre LGPD Art. 16 (eliminação após o
  fim da finalidade) para dados pessoais que **não** têm base de retenção legal: nome,
  e-mail, telefone de clientes/leads/pessoas continuariam no banco para sempre, disfarçados
  de "excluídos".
- **Opção C, anonimizar o que tem obrigação de retenção, apagar o resto de verdade.**
  Reconhece que "excluir a empresa" não é uma operação, são duas categorias de dado com
  regras diferentes.

## Decisão

Adotar a Opção C: uma nova RPC `SECURITY DEFINER`, chamada só pelo cron de retenção
(`service_role`) ou manualmente por um ultra-admin, que separa as tabelas com `empresa_id`
(mesmo levantamento do ADR 0042) em três grupos: retenção fiscal (anonimiza), sem retenção
(apaga) e trilha de auditoria/LGPD (preserva intacta, ver nota de implementação abaixo).

```sql
CREATE OR REPLACE FUNCTION public.excluir_empresa_retencao(p_empresa_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() NOT IN ('service_role') AND NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  -- Grupo 1: retenção fiscal/contratual de 5 anos (TERMS_OF_SERVICE §5).
  -- ANONIMIZA: mantém a linha (valor, data, categoria, o dado fiscal em si),
  -- zera/mascara o que identifica pessoa física (nome de contato, e-mail,
  -- CPF do lançamento, descrição livre que possa conter PII).
  -- Tabelas: lancamentos, receitas, despesas, faturas, contas, cartoes,
  -- folha_pagamento, marcos_faturamento, categorias_financeiras,
  -- centros_custo, grupos_parcela, lancamento_rateios, transferencias.
  UPDATE public.lancamentos SET descricao = '[anonimizado]', ... WHERE empresa_id = p_empresa_id;
  -- ... um UPDATE por tabela do grupo 1, cada um documentado com o campo
  -- que carrega PII naquela tabela especificamente (não é um padrão único,
  -- cada tabela tem colunas diferentes).

  -- Grupo 2: sem obrigação de retenção, apaga de verdade.
  -- Tabelas: as ~68 restantes (projetos, obras, clientes, propostas, leads,
  -- pessoas, tarefas, RDO, notificações da empresa, disciplinas, etc.).
  DELETE FROM public.projetos WHERE empresa_id = p_empresa_id;
  -- ... um DELETE por tabela do grupo 2, na ordem que respeita FKs (obras
  -- antes de projetos se houver referência, etc.), mesma ordem que um
  -- soft-delete em cascata já precisaria respeitar.

  -- Usuários: auth.users é apagado via chamada separada da EDGE (service
  -- role tem auth.admin.deleteUser, indisponível dentro de SQL puro) para
  -- cada profile.id da empresa, DEPOIS que os DELETEs acima rodaram (FKs
  -- ON DELETE CASCADE/SET NULL de auth.users para profiles/empresas
  -- dependem da ordem).

  -- empresas em si: soft delete (deleted_at), não DELETE. Mantém o
  -- registro de QUE existiu uma empresa com esse CNPJ (reforça a unicidade
  -- de CNPJ do ADR 0041 contra reuso indevido) e a trilha em
  -- admin_audit_logs continua apontando para um id válido.
  UPDATE public.empresas SET deleted_at = now(), nome = '[empresa excluída]'
  WHERE id = p_empresa_id;

  INSERT INTO public.admin_audit_logs (actor_email, actor_role, action, category,
    target_type, target_id, empresa_id, metadata)
  VALUES ('system@pilar', 'ultra_admin', 'empresa_excluida_retencao', 'billing',
    'empresa', p_empresa_id::text, p_empresa_id,
    jsonb_build_object('motivo', p_motivo, 'quando', now()));
END;
$$;
```

- **Cron `retencao-pos-trial`** (novo, mesmo esqueleto de `trial-expiry-cron`): dia 60 e 85
  envia aviso por e-mail (`templateRetencaoAviso`, a criar); dia 90 chama
  `excluir_empresa_retencao` para toda empresa com `leitura_desde <= now() - 90 dias AND
preservar_dados = false`.
- **`preservar_dados`** (já existe, Fase 2A) suspende o relógio inteiro: nem anonimiza nem
  apaga enquanto marcado. Reativar (pagar) dentro dos 90 dias limpa `leitura_desde` e nunca
  chega perto desta função.
- A separação exata grupo 1 / grupo 2 é decidida linha a linha na migration de
  implementação, não neste ADR: este documento fixa o **princípio** (retenção legal =
  anonimiza, resto = apaga), a lista completa das ~13 tabelas do grupo 1 vs o restante do
  grupo 2 é detalhe de implementação revisável sem precisar de um novo ADR, contanto que o
  princípio não mude.

## Nota de implementação (09/09, PR #487)

O rascunho acima previa só dois grupos. A implementação real precisou de um terceiro
(preservar sem tocar) e encontrou três problemas concretos que só apareceram rodando contra
dado de verdade, não algo visível só lendo o schema.

**Terceiro grupo, preservado intacto.** Sete tabelas sobrevivem sem anonimizar nem apagar:
`admin_audit_logs`, `audit_logs`, `audit_logs_archive` (trilha de auditoria, precisa
sobreviver à empresa que documenta), `data_deletion_requests`, `data_export_requests`,
`terms_acceptances`, `email_envios` (prova de conformidade LGPD e de aceite de termos). O
critério não foi arbitrário: essas sete tabelas são exatamente as que já tinham a FK
`empresa_id → empresas` desenhada como `ON DELETE SET NULL` ou sem FK nenhuma (ao contrário
de todas as outras, que são `CASCADE`), um sinal de que specs anteriores (049, 003) já tinham
decidido que esses registros deveriam sobreviver a uma eventual exclusão física da empresa.

**`lancamentos` é VIEW, não tabela.** É `receitas UNION despesas` (SPEC 033/ADR 0017). Um
`UPDATE public.lancamentos ...` como o rascunho original sugeria teria falhado só na
primeira chamada real da função (não existe erro de tipo ou de migration que pegue isso
antes). Anonimizar `receitas` e `despesas` diretamente já cobre o que a view mostra.

**`soft_delete_generic()` (SPEC 060) intercepta o `DELETE`.** ~16 tabelas do grupo 2
(`projetos`, `clientes`, `pessoas`, `propostas` etc.) já tinham um trigger `BEFORE DELETE`
de uma feature de soft-delete anterior, sem relação com esta spec, que converte QUALQUER
`DELETE` num `UPDATE deleted_at` e cancela a exclusão física em silêncio (`RETURN NULL`, sem
erro). A RPC "apagaria" sem apagar nada, PII inteiro continuaria no banco. Fix: os dois
triggers (esse e o `enforce_empresa_nao_leitura` do ADR 0042) checam uma GUC local à
transação (`current_setting('pilar.retencao_em_curso', true) = 'on'`, ligada só por esta
RPC via `set_config(..., true)`) para pular o comportamento normal e deixar o `DELETE`
físico seguir. GUC local à transação nunca vaza pra outra sessão/empresa concorrente,
ao contrário de `ALTER TABLE ... DISABLE TRIGGER` (que desabilitaria o trigger pra TODAS as
sessões enquanto durasse, um risco real de correção num sistema multi-tenant).

**Duas FKs `CASCADE` destruiriam registro fiscal.** `folha_pagamento.pessoa_id` e
`marcos_faturamento.projeto_id` eram `NOT NULL` com `ON DELETE CASCADE` para
`pessoas`/`projetos`. Apagar a pessoa ou o projeto (grupo 2) cascatearia e destruiria a
folha de pagamento ou o marco de faturamento (grupo 1, retenção fiscal de 5 anos) junto,
o oposto do que este ADR promete. As duas colunas viraram nullable com `ON DELETE SET NULL`:
o vínculo se perde, o valor fiscal permanece.

**Mitigação de risco entregue**: `ultra_admin_listar_retencao()` (nova RPC) lista empresas em
modo leitura pro ultra-admin, com botão de disparo manual (nome da empresa digitado como
confirmação) que chama esta RPC fora do cron, exatamente como previsto na negativa abaixo.

28 pgTAP novos (multi-pass de exclusão, anonimização preserva valor fiscal, grupo 2 some,
grupo preservado sobrevive) + 7 pra `ultra_admin_listar_retencao`.

## Consequências

**Positivas:**

- Cumpre as duas obrigações ao mesmo tempo em vez de escolher uma: retenção fiscal de 5
  anos (Opção A quebraria isso) e eliminação de PII sem base legal de retenção (Opção B
  quebraria isso).
- `empresas` sobrevive como linha soft-deleted: CNPJ continua bloqueado contra reuso
  indevido (squatting, ADR 0041), e a auditoria em `admin_audit_logs` nunca aponta para um
  `empresa_id` inexistente.
- Motivo e timestamp da exclusão ficam registrados, dando ao ultra-admin uma trilha real se
  um cliente reclamar "minha empresa sumiu".

**Negativas:**

- É a operação mais destrutiva e irreversível de todo o produto até hoje. Erro na lista de
  tabelas do grupo 2 (esquecer que uma tabela nova deveria estar no grupo 1) apaga dado que
  deveria ter sido só anonimizado, sem como desfazer.
- Ao contrário do ADR 0042 (que generaliza bem via `information_schema`), aqui a
  classificação grupo 1 vs grupo 2 **não pode** ser automática: exige julgamento humano por
  tabela (tem obrigação fiscal? tem PII solto numa coluna de texto livre?). Toda tabela
  nova com `empresa_id` precisa ser classificada manualmente antes de entrar num dos três
  grupos; ao contrário do ADR 0042, aqui esquecer uma tabela nova é uma lacuna real (ela
  cairia no grupo 2 por padrão via `information_schema` e seria apagada quando talvez
  devesse ser preservada ou anonimizada).
- Depende de decisão de produto/jurídica que este ADR não resolve sozinho: a lista exata de
  colunas com PII por tabela do grupo 1 deveria, idealmente, ser revisada por alguém com
  contexto jurídico antes de ir para produção, o mesmo risco aceito já registrado em
  `docs/legal/README.md` para o texto dos termos em geral.
- Sem ambiente de teste que rode isso contra um volume real de produção antes do primeiro
  disparo automático (dia 90 de um trial de verdade só acontece ~3 meses depois do
  lançamento): o primeiro uso em produção é, na prática, o primeiro teste de carga real.
  Mitigado na implementação (ver nota acima): botão de disparo manual no ultra-admin.

## Decisões relacionadas

- [ADR 0042](./0042-somente-leitura-pos-trial-via-trigger-generico.md): mesmo levantamento
  de tabelas com `empresa_id`, reusado aqui para a classificação grupo 1/grupo 2; a RPC
  desta ADR também precisa driblar o trigger daquele ADR na empresa que está apagando.
- [ADR 0041](./0041-acesso-no-trial-por-nivel-de-confianca-derivado-de-fatos.md): CNPJ único
  entre empresas, por isso `empresas` fica soft-deleted em vez de apagada de fato.
- [SPEC 060](../../specs/060-soft-delete-por-rpc.md): padrão de soft delete que a exclusão de
  `empresas` (mas não do resto) reaproveita, e cujo trigger genérico (`soft_delete_generic`)
  precisou ganhar um escape pra esta RPC funcionar (ver nota de implementação).
- [SPEC 033](../../specs/033-lancamentos-fonte-unica-filtros-parcelas.md) / [ADR 0017](./0017-lancamentos-pagina-server-side.md):
  `lancamentos` é view, não tabela; anonimizar `receitas`/`despesas` cobre o que ela mostra.
- [SPEC 098](../../specs/098-trial-em-niveis-de-confianca.md), requisito 22 e Fase 3.
- `docs/legal/TERMS_OF_SERVICE.md`, seção 5: base contratual para anonimizar em vez de
  eliminar dados sob retenção legal.
