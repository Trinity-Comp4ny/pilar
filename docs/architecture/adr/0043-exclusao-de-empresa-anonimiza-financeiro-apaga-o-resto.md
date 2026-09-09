# ADR 0043: Exclusão de empresa no dia 90 anonimiza dados fiscais/financeiros e apaga o resto

**Data:** 2026-09-09  
**Status:** Proposed

## Contexto

SPEC 098 (requisito 22): trial vencido em somente leitura por 90 dias, sem `preservar_dados`,
é excluído no dia 90 "pelo fluxo de exclusão já existente". Esse fluxo **não existe**. O que
há hoje:

- `data_deletion_requests` + `request_data_deletion()`
  (`supabase/migrations/20260504400000_data_deletion_requests.sql`): pedido de **um usuário**
  (LGPD Art. 18 IV), não de uma empresa inteira. Cria uma linha `pending`; nenhum código
  executa a exclusão de fato — é processo 100% manual do admin, com um `TODO` explícito no
  arquivo pra plugar uma edge function que ainda não existe.
- `delete-user` (edge function): remove **um** `auth.users`, não uma empresa.
- Soft delete (SPEC 060): apaga (marca `deleted_at`) registros dentro de uma empresa, não a
  empresa em si — e é acionado pelo próprio usuário, não por um cron de retenção.

Ou seja, a Fase 3 não está "ligando um fluxo existente", está desenhando um do zero: apagar
de verdade os dados de uma empresa inteira, disparado automaticamente por um cron, sem
intervenção humana no caminho feliz. Isso é irreversível e tem uma restrição legal real, já
registrada nos próprios termos de uso
(`docs/legal/TERMS_OF_SERVICE.md`, seção 5): *"depois disso, os dados são anonimizados ou
eliminados conforme a Política de Privacidade e obrigações legais de retenção (ex.: fiscal,
5 anos)"* — o texto já prevê os dois caminhos (anonimizar vs eliminar), não só um.

- **Opção A, `DELETE` físico de tudo.** Mais simples de implementar (reusa a mesma
  varredura de tabelas do ADR 0042). Viola a obrigação de retenção fiscal de 5 anos que o
  próprio contrato do Pilar já assume perante o cliente — lançamentos, faturas, notas,
  folha de pagamento não podem simplesmente sumir.
- **Opção B, `UPDATE ... SET deleted_at = now()` (soft delete) em tudo, nunca apagar
  de verdade.** Resolve a obrigação fiscal, mas não cumpre LGPD Art. 16 (eliminação após o
  fim da finalidade) para dados pessoais que **não** têm base de retenção legal — nome,
  e-mail, telefone de clientes/leads/pessoas continuariam no banco para sempre, disfarçados
  de "excluídos".
- **Opção C, anonimizar o que tem obrigação de retenção, apagar o resto de verdade.**
  Reconhece que "excluir a empresa" não é uma operação, são duas categorias de dado com
  regras diferentes.

## Decisão

Adotar a Opção C: uma nova RPC `SECURITY DEFINER`, chamada só pelo cron de retenção
(`service_role`), que separa as ~81 tabelas com `empresa_id` (mesmo levantamento do
ADR 0042) em dois grupos.

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
  -- ANONIMIZA: mantém a linha (valor, data, categoria — o dado fiscal em si),
  -- zera/mascara o que identifica pessoa física (nome de contato, e-mail,
  -- CPF do lançamento, descrição livre que possa conter PII).
  -- Tabelas: lancamentos, receitas, despesas, faturas, contas, cartoes,
  -- folha_pagamento, marcos_faturamento, categorias_financeiras,
  -- centros_custo, grupos_parcela, lancamento_rateios, transferencias.
  UPDATE public.lancamentos SET descricao = '[anonimizado]', ... WHERE empresa_id = p_empresa_id;
  -- ... um UPDATE por tabela do grupo 1, cada um documentado com o campo
  -- que carrega PII naquela tabela especificamente (não é um padrão único,
  -- cada tabela tem colunas diferentes).

  -- Grupo 2: sem obrigação de retenção — apaga de verdade.
  -- Tabelas: as ~68 restantes (projetos, obras, clientes, propostas, leads,
  -- pessoas, tarefas, RDO, notificações da empresa, disciplinas, etc.).
  DELETE FROM public.projetos WHERE empresa_id = p_empresa_id;
  -- ... um DELETE por tabela do grupo 2, na ordem que respeita FKs (obras
  -- antes de projetos se houver referência, etc.) — mesma ordem que um
  -- soft-delete em cascata já precisaria respeitar.

  -- Usuários: auth.users é apagado via chamada separada da EDGE (service
  -- role tem auth.admin.deleteUser, indisponível dentro de SQL puro) para
  -- cada profile.id da empresa, DEPOIS que os DELETEs acima rodaram (FKs
  -- ON DELETE CASCADE/SET NULL de auth.users para profiles/empresas
  -- dependem da ordem).

  -- empresas em si: soft delete (deleted_at), não DELETE — mantém o
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
- **`preservar_dados`** (já existe, Fase 2A) suspende o relógio inteiro — nem anonimiza nem
  apaga enquanto marcado. Reativar (pagar) dentro dos 90 dias limpa `leitura_desde` e nunca
  chega perto desta função.
- A separação exata grupo 1 / grupo 2 é decidida linha a linha na migration de
  implementação, não neste ADR — este documento fixa o **princípio** (retenção legal =
  anonimiza, resto = apaga), a lista completa das ~13 tabelas do grupo 1 vs ~68 do grupo 2
  é detalhe de implementação revisável sem precisar de um novo ADR, contanto que o
  princípio não mude.

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
  deveria ter sido só anonimizado — sem como desfazer.
- Ao contrário do ADR 0042 (que generaliza bem via `information_schema`), aqui a
  classificação grupo 1 vs grupo 2 **não pode** ser automática: exige julgamento humano por
  tabela (tem obrigação fiscal? tem PII solto numa coluna de texto livre?). Toda tabela
  nova com `empresa_id` precisa ser classificada manualmente antes de entrar num dos dois
  grupos — ao contrário do ADR 0042, aqui esquecer uma tabela nova é uma lacuna real (ela
  não seria nem anonimizada nem apagada, ficando presa para sempre com dado de empresa já
  excluída).
- Depende de decisão de produto/jurídica que este ADR não resolve sozinho: a lista exata de
  colunas com PII por tabela do grupo 1 deveria, idealmente, ser revisada por alguém com
  contexto jurídico antes de ir para produção — o mesmo risco aceito já registrado em
  `docs/legal/README.md` para o texto dos termos em geral.
- Sem ambiente de teste que rode isso contra um volume real de produção antes do primeiro
  disparo automático (dia 90 de um trial de verdade só acontece ~3 meses depois do
  lançamento) — o primeiro uso em produção é, na prática, o primeiro teste de carga real.
  Mitigação na implementação: o ultra-admin ganha um botão de disparo manual (fora do cron)
  para testar em uma empresa isolada antes do primeiro disparo automático valer.

## Decisões relacionadas

- [ADR 0042](./0042-somente-leitura-pos-trial-via-trigger-generico.md): mesmo levantamento
  de tabelas com `empresa_id`, reusado aqui para a classificação grupo 1/grupo 2.
- [ADR 0041](./0041-acesso-no-trial-por-nivel-de-confianca-derivado-de-fatos.md): CNPJ único
  entre empresas, por isso `empresas` fica soft-deleted em vez de apagada de fato.
- [SPEC 060](../../specs/060-soft-delete-por-rpc.md): padrão de soft delete que a exclusão de
  `empresas` (mas não do resto) reaproveita.
- [SPEC 098](../../specs/098-trial-em-niveis-de-confianca.md), requisito 22 e Fase 3.
- `docs/legal/TERMS_OF_SERVICE.md`, seção 5: base contratual para anonimizar em vez de
  eliminar dados sob retenção legal.
