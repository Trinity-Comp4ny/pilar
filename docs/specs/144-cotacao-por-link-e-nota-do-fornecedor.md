# SPEC: Cotação por link e nota do fornecedor

**Data:** 2026-10-28
**Status:** Em implementação (protótipo v1 aprovado em 2026-10-28)
**Autor:** Matheus Rezende
**Módulo:** obras (cotações e fornecedores)
**Protótipo:** v1 no Claude Design (https://claude.ai/artifact/CtPyfau47mv6yciByzJdUE), desktop e mobile, aprovado
**Origem:** ideia interna de 14/10/2026 (reunião com a Obra Guru). Card BEZ-351 (https://app.clickup.com/t/1dfhfaq7ttw), filho do BEZ-345. Estende as SPECs 018, 023 e 064 (cotações) e 026 (inteligência do fornecedor).

## Problema

Hoje quem compra pela obra cria a cotação e digita, uma a uma, as propostas que o fornecedor mandou por
WhatsApp ou e-mail. É trabalho de digitação, com erro de transcrição, e a resposta do fornecedor não tem
prazo nem registro de quando chegou. Depois da compra, a experiência com o fornecedor (demorou, entregou
no prazo, a qualidade) fica na cabeça de quem comprou: a página do fornecedor (SPEC 026) mostra o que
ele cotou e vendeu, mas não como foi.

## Objetivo

O escritório gera um link da cotação e manda ao fornecedor; o fornecedor preenche preço, pagamento,
desconto e prazo sem criar conta, e a proposta entra sozinha na cotação. Depois de fechar a compra, o
escritório dá uma nota de 0 a 5 por quatro critérios, que aparece na página do fornecedor.

**Fora de escopo:**

- Portal do fornecedor com login, histórico ou várias cotações (o link é de uma cotação, uma resposta).
- Nota calculada sozinha (decisão de 28/10: a nota é dada pelo escritório).
- Ranking automático de "melhor fornecedor" e comparador lado a lado (continuam fora, como na SPEC 026).
- Cotação em cesta (`tipo = 'cesta'`): o link vale para cotação de item único. Cesta tem lista de itens por proposta e fica para um card de seguimento.
- Envio do link por WhatsApp ou e-mail pelo Pilar (o escritório copia o link; envio fica para um card).
- Upload de arquivo de orçamento pelo fornecedor (só o campo de link que a proposta já tem).
- Fornecedor ver as propostas dos concorrentes ou o orçamento da obra: nunca.

## Requisitos

**Link e resposta**

1. Na cotação aberta de item único, botão **Gerar link** por fornecedor convidado. O escritório escolhe o
   fornecedor do cadastro, ou digita o nome e o fornecedor novo entra no cadastro, e a validade (3, 7, 15 ou
   30 dias, padrão 7). Cada convite tem o seu link. No máximo 20 links ativos por cotação.
2. O link abre `/cotar/<token>` sem login. A página mostra: nome da empresa, descrição, quantidade e
   unidade dos itens, prazo de necessidade e observações da cotação. Não mostra nome nem endereço da
   obra, valores de outras propostas nem o orçamento.
3. O fornecedor informa: valor à vista, valor parcelado (opcional), condição de pagamento, desconto em
   % (opcional), prazo de entrega em dias e observações.
4. Enviar cria a proposta na cotação com origem `link`, marcada "Preenchido pelo fornecedor". O
   escritório continua editando como qualquer proposta.
5. O fornecedor pode corrigir a resposta pelo mesmo link até a cotação fechar ou o link expirar. Cada
   envio sobrescreve a proposta e guarda `respondido_em`.
6. Link expirado, revogado ou de cotação fechada mostra "Esta cotação foi encerrada. Fale com <empresa>."
   sem revelar o motivo exato.
7. O escritório vê na cotação o estado de cada convite: **Enviado**, **Aberto**, **Respondido**,
   **Expirado**, e pode **Revogar** ou **Gerar novo link** (o link antigo é revogado; o link em si só aparece no momento de gerar).
8. Quando uma resposta chega, o convite vira Respondido e o autor da cotação recebe notificação
   (central da SPEC 029).

**Nota do fornecedor**

9. Depois que a cotação tem proposta vencedora, o escritório vê **Avaliar fornecedor** na proposta
   vencedora (e só nela). A nota é por quatro critérios de 0 a 5: **Demora na resposta**, **Preço**,
   **Prazo de entrega**, **Qualidade**, mais um comentário curto opcional.
10. A nota geral da avaliação é a média dos critérios preenchidos (uma casa decimal). Todos os critérios
    são opcionais, mas é preciso preencher ao menos um.
11. A página do fornecedor (`/fornecedores/:id`) ganha a nota média, o número de avaliações e as
    avaliações recentes, com quem avaliou e em qual cotação. Fornecedor sem avaliação mostra "Sem avaliação".
12. A avaliação pode ser editada por quem a criou e por quem edita fornecedores. O fornecedor nunca vê
    a nota.

Requisitos não-funcionais:

- **Segurança do link:** token aleatório de 32 bytes (base64url), guardado só como hash (SHA-256);
  o link completo existe só no momento de gerar. A edge `cotacao-link` valida o token no corpo da
  requisição (nunca na URL da API nem em log), não confia em nenhum id vindo do cliente e responde igual
  para token inexistente, expirado ou revogado (sem enumeração).
- **Abuso:** rate limit por token e por IP (padrão `_shared`), limite de tamanho e validação de shape
  com zod na borda; valores com teto e `prazo_entrega_dias` inteiro positivo.
- **RLS:** `obra_cotacao_convite` e `fornecedor_avaliacao` por `empresa_id`; a resposta pública escreve
  só pela edge (service role) e só na cotação do convite. Nenhuma policy para `anon`.
- **Multi-tenant:** a avaliação e o convite herdam a `empresa_id` da cotação, validada no banco.
- **LGPD:** a página pública não coleta dado pessoal além do nome e contato que o fornecedor digitar
  para a proposta; o registro de IP do rate limit não é persistido.
- **Repo público:** nada de detalhe de vulnerabilidade em doc ou comentário.

## Critérios de aceite

- [ ] Dado uma cotação aberta, quando o escritório gera o link, então o convite nasce como Enviado e o
      token aparece uma vez para copiar; no banco só existe o hash.
- [ ] Dado o link válido, quando abre, então a página mostra os itens e o prazo e não mostra nome da
      obra, propostas de outros fornecedores nem valores do orçamento (teste de contrato da edge).
- [ ] Dado o formulário válido, quando envia, então existe uma proposta com origem `link` e o convite
      vira Respondido; enviar de novo sobrescreve, sem criar segunda proposta.
- [ ] Dado link expirado, revogado ou de cotação fechada, então a página mostra o texto de encerrada e
      a edge devolve a mesma resposta dos três casos.
- [ ] Dado token inexistente, então a resposta é idêntica à de token expirado (sem enumeração).
- [ ] Dado valor negativo, prazo fracionado ou corpo grande demais, então a edge recusa com mensagem clara.
- [ ] Dado mais tentativas que o limite, então a edge responde 429 sem processar.
- [ ] Dado uma cotação com vencedora, quando o escritório avalia com notas 5, 4, 3 e 4, então a nota
      geral é 4,0 e aparece na página do fornecedor.
- [ ] Dado uma avaliação sem nenhum critério, então o formulário bloqueia e diz o que falta.
- [ ] Dado a proposta não vencedora, então não há botão Avaliar.
- [ ] Dado um usuário de outra empresa, então nem o convite nem a avaliação são visíveis (pgTAP como
      `authenticated`).
- [ ] Caso de borda: dois envios quase simultâneos do mesmo link; vale o último e existe uma só proposta.
- [ ] Caso de borda: cotação fechada com resposta chegando ao mesmo tempo; a edge recusa a que chegou depois.
- [ ] Deno test da edge (token, expiração, shape) e pgTAP das tabelas novas.

## Dados e contratos

Migration:

- `obra_cotacao_convite`: `id`, `empresa_id`, `cotacao_id`, `fornecedor_id` (sempre cadastrado: o nome
  digitado cria o cadastro), `fornecedor_nome`, `token_hash` (único), `expira_em`, `aberto_em`, `respondido_em`, `revogado_em`,
  `proposta_id` (null até responder), `created_by`, `created_at`.
- `obra_cotacao_proposta`: `origem text not null default 'manual'` (`manual` ou `link`) e
  `desconto_pct numeric(5,2) null`.
- `fornecedor_avaliacao`: `id`, `empresa_id`, `fornecedor_id`, `cotacao_id`, `proposta_id` (único),
  `nota_demora`, `nota_preco`, `nota_prazo`, `nota_qualidade` (smallint 0 a 5, null permitido),
  `nota_geral numeric(2,1)` (calculada por trigger), `comentario`, `avaliado_por`, `avaliado_em`.
  Check de ao menos um critério preenchido.
- RPCs do escritório (`SECURITY DEFINER`, conferem empresa e permissão): `rpc_criar_convite_cotacao`,
  `rpc_revogar_convite_cotacao`, `rpc_avaliar_fornecedor`. O SELECT do convite não inclui `token_hash`
  (privilégio por coluna).
- RPCs só do `service_role`, chamadas pela edge: `cotacao_link_consultar` e `cotacao_link_responder`, por
  hash do token; token inexistente, expirado, revogado ou de cotação encerrada devolvem o mesmo `{"ok": false}`.
- Edge `cotacao-link` (`GET` consulta, `POST` envia), no padrão `_shared/cors.ts` + rate limit; sem JWT,
  com a allowlist de anon da auditoria do banco atualizada.
- `npm run gen:types:local` e commitar o `types.ts`; baseline da auditoria do banco sobe junto.

Retorno da consulta pública (shape fechado, validado na saída): `empresa_nome`, `descricao`, `itens[]`
(`descricao`, `quantidade`, `unidade`), `prazo_necessidade`, `observacoes`, `resposta_atual` (a do próprio
convite, se existir).

## Plano de implementação

1. ADR curto sobre link público por token (se o padrão for repetir no Pilar Campo e no portal) e esta
   spec aprovada com o protótipo.
2. Migration, RPCs, pgTAP e `gen:types:local`.
3. Edge `cotacao-link` com zod, hash, rate limit e testes Deno.
4. Página pública `/cotar/:token` (desktop e mobile, estados vazio, carregando, erro e encerrada).
5. Convites na aba Cotações da obra: gerar, copiar, revogar, estados, notificação.
6. Avaliação do fornecedor na proposta vencedora e nota na página do fornecedor.
7. E2E visual: regenerar referências pelo CI.

## Decisões e riscos

- Decisão de 28/10 (Matheus): a nota é dada pelo escritório por quatro critérios, depois de fechar a
  compra. **Reverte a exclusão de "nota manual" e "portal do fornecedor" da SPEC 026**; atualizar o
  "Fora de escopo" da 026 no mesmo PR.
- Risco: página pública é superfície nova. Revisão de segurança (`rls-auditor` e checagem manual da
  edge) antes de abrir o PR; sem dado da obra na resposta.
- Risco: fornecedor pode preencher valor absurdo ou spam com link vazado. Mitigação: validade curta,
  revogação, teto de valor, rate limit; a proposta nunca vence sozinha, o escritório decide.
- Premissa: um link por fornecedor por cotação. Cotação enviada ao mesmo fornecedor duas vezes gera dois convites.
- Risco: o replay de sessão do Sentry (só em erro) grava a URL da página pública, token incluso. Eventos,
  transações e breadcrumbs são mascarados (`/cotar/[link]`), o replay não. A página manda `noindex` e
  `no-referrer`. Fechar com a revogação do link e a validade curta; avaliar bloquear replay nessa rota.
- Pendente para depois: envio do link por WhatsApp/e-mail pelo Pilar e upload de arquivo do orçamento.
