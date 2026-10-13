# SPEC 117: Portal ultra admin na sidebar, com páginas próprias

**Data:** 2026-10-13
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** ultra-admin + shell
**Relacionada:** [SPEC 001](001-shell-3-pilares.md) (shell), [SPEC 098](098-trial-em-niveis-de-confianca.md) (trial e retenção), [SPEC 104](104-trial-3-dias-e-empresa-convidada.md) (empresa convidada), [SPEC 112](112-feedback-no-banco-com-print-anotado.md) (feedback), [SPEC 113](113-avisos-do-ultra-admin-por-email.md) (avisos)

## Problema

O `/ultra-admin` é uma página só, com nove abas numa faixa no topo, e cresceu
sem desenho: o dashboard mostra quatro números soltos, a lista de empresas só
abre por um botão "Abrir", o detalhe da empresa empilha cards de capacidade,
cobrança e acesso antecipado que não refletem o modelo atual (não há cobrança
por usuário nem por feature), não dá pra excluir uma empresa (só "arquivar",
que aparece como "Cancelada" e confunde com a cobrança cancelada), a atividade
mostra códigos crus (`update_company`), o painel de tokens abre com um
parágrafo de seis linhas e a aba "Trials" mostra "Dias em leitura 4 / 90" sem
dizer o que isso significa. Resultado: o dono da plataforma não consegue
responder rápido "como estão minhas empresas, quem precisa de atenção, quanto
a IA está custando".

## Objetivo

O ultra admin entra no portal por um botão no trilho de módulos, navega pelas
seções no painel lateral (sem faixa de abas) e cada seção responde uma
pergunta com pouco texto: situação das empresas, quem precisa de atenção,
uso e custo de IA por empresa, agente e requisição.

**Fora de escopo:**

- Custo de IA vindo do Sentry: a fonte de verdade é o `ai_token_ledger` no
  banco (já tem custo por chamada). Sentry segue só pra erro e performance.
- Impersonar uma empresa específica (o "Ver como" atual é por papel, dentro da
  própria empresa).
- Mudar regras de trial, retenção ou cobrança: só a apresentação muda.

## Requisitos

1. Ultra admin vê um item "Ultra" no trilho de módulos (desktop). Clicar abre
   `/ultra-admin` e o painel lateral passa a listar as seções do portal,
   agrupadas: Plataforma (Visão geral, Empresas, Usuários, Testes), Produto
   (Funcionalidades, Feedback), Operação (Atividade, Incidentes, Custos de IA).
   Feedback novo aparece como contador no item.
2. Cada seção é uma rota (`/ultra-admin/<secao>`). Links antigos
   `/ultra-admin?tab=<aba>` (sino, e-mails, notificações já gravadas) redirecionam
   pra rota nova. A faixa "Modo plataforma ativo" sai.
3. Visão geral: números com contexto (empresas por situação, usuários, cadastros
   nos últimos 30 dias, custo de IA no mês), uma lista "Precisa de atenção"
   (teste vencendo em até 2 dias, pagamento em atraso, gasto de IA anômalo hoje,
   feedback novo, incidente aberto) e os cadastros recentes.
4. Empresas: tabela padrão (`DataTable`) com a linha inteira clicável, busca,
   filtro por situação com contagem, colunas Empresa (nome + CNPJ), Situação,
   Plano, Usuários, Último acesso, Criada em. "Situação" junta status da empresa e
   cobrança num selo só: Pagante, Em teste, Convidada, Teste vencido, Em atraso,
   Assinatura cancelada, Suspensa, Arquivada.
5. Detalhe da empresa (`/ultra-admin/empresas/:id`): cabeçalho com situação e
   fatos (plano, cobrança, usuários, projetos ativos, último acesso, criada em),
   ações num menu, e abas Visão geral, Usuários, Atividade. Sai o card de
   capacidade e o de acesso antecipado; a cobrança vira uma linha com a ação
   cabível ("Começar a cobrar" pra convidada, "Tornar convidada" pra quem não paga).
6. Excluir empresa: só sem uso ativo (arquivada, ou em só leitura pós-teste sem
   "preservar dados"), digitando o nome e um motivo. Reusa
   `excluir_empresa_retencao` (anonimiza fiscal, apaga o resto, empresa fica
   soft-deleted) e apaga os logins da empresa. Empresa excluída some das listas.
   A aba Testes usa o mesmo caminho no "Excluir agora", que antes deixava os
   logins para trás.
7. Usuários: tabela com nome, empresa, papel, último acesso e criado em; linha
   abre a empresa na aba Usuários; remover pelo menu da linha.
8. Funcionalidades: catálogo do que é liberado pra todas e do que está em teste
   fechado (feature flag em `empresas.features`), com liga/desliga por empresa e
   em massa. Módulo dormente não aparece.
9. Atividade: feed único, em frase legível, juntando log administrativo e avisos
   da plataforma (novo cadastro, feedback, plano bloqueado), agrupado por dia,
   filtrável por empresa e tipo.
10. Feedback: contadores por status, filtro por tipo e status, detalhe lateral com
    texto inteiro, print e contexto. Novo status "Resolvido".
11. Incidentes: estado atual de cada componente da status page no topo,
    incidentes abertos primeiro com timeline, resolvidos recolhidos.
12. Custos de IA: custo, receita e margem do mês, custo médio por chamada, por
    empresa, por agente e as últimas requisições (modelo, tokens, custo). Texto
    de apoio em uma linha.
13. Testes: duas listas com explicação curta, "Em teste" (vence em, nível de
    confiança, uso) e "Teste vencido, só leitura" (vencido há, exclusão
    automática em, avisos enviados).

Requisitos não-funcionais:

- **Segurança:** rotas seguem atrás de `UltraAdminRoute` (papel + MFA aal2).
  Exclusão de empresa só por edge com `requireUltraAdmin`, recusa empresa que
  tenha ultra admin entre os usuários (nunca apaga o próprio acesso).
- **Contrato tolerante:** o front aceita a resposta antiga das edges (campos
  novos opcionais) pra não quebrar entre o merge e o deploy das functions.

## Critérios de aceite

- [x] Dado um ultra admin, quando abre qualquer tela, então vê "Ultra" no
      trilho; clicando, o painel lista as seções do portal.
- [x] Dado o link `/ultra-admin?tab=trials`, quando aberto, então cai em
      `/ultra-admin/testes`.
- [x] Dada a lista de empresas, quando clico numa linha, então abre o detalhe.
- [x] Dada uma empresa ativa, então "Excluir" não aparece; arquivada, aparece e
      exige nome + motivo (testado no local: empresa soft-deleted, login apagado,
      `delete_company` no log).
- [x] Dada uma ação `create_company` no log, então a atividade mostra
      "criou a empresa X", não o código.
- [ ] Dado um usuário comum, então o item "Ultra" não aparece.

## Dados e contratos

- Migration: `feature_suggestions.status_interno` aceita `resolvido`.
- Edge `ultra-admin-empresas`:
  - `GET` lista: ignora `deleted_at`, devolve `created_at` e `ultimo_acesso`.
  - `GET ?id=`: devolve `uso` (`projetos_ativos`, `ultimo_acesso`) e
    `last_sign_in_at` por usuário.
  - `DELETE { empresa_id, confirm_name, motivo }`: exclui (requisito 6).
  - `PUT` grava `new_status` no log, pra atividade dizer "arquivou"/"reativou".
- Edge `ultra-admin-usuarios`: `GET` lista todos os usuários com
  `last_sign_in_at` e `created_at`.

## Decisões e riscos

- Sem ADR: é extensão do shell (SPEC 001) e reorganização de telas.
- Excluir passa por arquivar antes: duas etapas, porque é irreversível.
