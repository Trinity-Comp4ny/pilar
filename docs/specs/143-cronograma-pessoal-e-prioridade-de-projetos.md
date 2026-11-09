# SPEC: Cronograma pessoal e ordem de prioridade dos projetos

**Data:** 2026-10-28
**Status:** Em implementação (protótipo v1 aprovado em 2026-10-28)
**Autor:** Matheus Rezende
**Módulo:** projetos
**Protótipo:** v1 no Claude Design (https://claude.ai/artifact/CtPyfau47mv6yciByzJdUE), desktop e mobile, aprovado
**Origem:** feedback da VRZ de 22/10/2026 em /projetos/cronograma ("Cronograma pessoal"). Card BEZ-350 (https://app.clickup.com/t/1dfhfaq7ttv), filho do BEZ-345. Estende a SPEC 027 (cronograma em dois níveis).

## Problema

O coordenador passa a ordem de prioridade dos projetos por fora do sistema (conversa, planilha). A
pessoa da equipe já preenche início e entrega das próprias disciplinas, mas o cronograma mostra todos os
projetos da empresa, na ordem do cadastro. Para ver "o que eu entrego e em que ordem" ela filtra
responsável na mão e ainda não sabe qual projeto vem primeiro.

## Objetivo

Duas coisas na tela que já existe (`/projetos/cronograma`): o coordenador define a ordem de prioridade
dos projetos arrastando, e cada pessoa liga **Meus projetos** para ver só o que é dela, nessa ordem, com
início e entrega de cada disciplina num lugar só.

**Fora de escopo:**

- Aba nova em Meu trabalho (decisão de 28/10: o filtro mora no cronograma existente).
- Prioridade por pessoa (a ordem é do projeto, uma só para a empresa).
- Distribuir ou rebalancear carga (a tela de Capacidade segue dormente).
- Notificar a pessoa quando a ordem muda.
- Substituir o campo `prioridade` (alta, média, baixa) do projeto: ele continua; a ordem é outro eixo.

## Requisitos

1. O cronograma ordena os projetos por **ordem de prioridade** (menor número primeiro). Projetos sem
   ordem vêm depois, pela data de início, como hoje.
2. Cada projeto com ordem mostra um selo `#n` ao lado do nome, para todos os papéis.
3. Quem edita projetos (`can("projetos", "create")`) vê uma alça de arraste na linha do projeto, só no
   desktop e só sem filtro ativo (reordenar uma lista filtrada renumeraria só uma parte). Soltar regrava a
   ordem como 1..N numa só chamada: os visíveis na ordem nova e, depois deles, os que o cronograma não
   mostra (sem datas), na ordem em que já estavam. A alça também funciona pelo teclado (espaço e setas).
4. Botão **Meus projetos** (segmento ao lado do filtro Responsável) mostra só projetos onde a pessoa do
   usuário logado é responsável por ao menos uma disciplina. Reaproveita `useMinhaPessoa`, a mesma
   resolução de pessoa do Meu trabalho. O estado vai na URL (`?meus=1`) para link e atualização.
5. Em **Meus projetos**, as disciplinas da pessoa vêm expandidas, com início e entrega. As de outras
   pessoas ficam recolhidas atrás de "+N disciplinas de outras pessoas".
6. Em **Meus projetos** a alça de arraste some (reordenar é uma ação sobre a lista completa). O selo `#n`
   continua.
7. Projeto pausado ou concluído segue a regra atual do cronograma (SPEC 141): pausado mostra Pausado.
8. Estado vazio de **Meus projetos**: "Nenhum projeto com disciplina sua. Peça ao coordenador para
   atribuir você a uma disciplina." com botão **Ver todos os projetos**.
9. Mobile: o cronograma ganha o mesmo filtro e o selo; reordenar só no desktop. A linha "+N disciplinas de
   outras pessoas" vira "+N de outras" na coluna estreita do celular.

Requisitos não-funcionais:

- **Segurança / RLS:** coluna nova em `projetos`, sem policy nova (a RLS por `empresa_id` já cobre).
  A escrita da ordem passa só pela RPC `rpc_reordenar_projetos(uuid[])`: `SECURITY DEFINER`,
  `search_path = public`, `REVOKE` de `PUBLIC`, `GRANT` a `authenticated`, checa empresa e permissão
  de editar projeto; rejeita id de outra empresa.
- **Performance:** a RPC faz um `UPDATE ... FROM unnest(...) WITH ORDINALITY`, uma ida ao banco.
- **Multi-tenant:** nenhuma ordem vaza entre empresas.

## Critérios de aceite

- [ ] Dado três projetos com ordens 2, 1 e sem ordem, então o cronograma lista 1, 2 e o sem ordem.
- [ ] Dado um coordenador, quando arrasta o projeto da posição 3 para a 1, então a ordem vira 1..N
      numa chamada e a lista reflete sem recarregar.
- [ ] Dado um usuário sem permissão de editar, então não há alça e a RPC recusa chamada direta.
- [ ] Dado `?meus=1` e uma pessoa responsável por disciplinas em 2 dos 5 projetos, então só esses 2
      aparecem, na ordem de prioridade, com as disciplinas dela expandidas.
- [ ] Dado `?meus=1` e nenhuma disciplina da pessoa, então aparece o estado vazio com o botão.
- [ ] Dado um id de outra empresa na lista, então a RPC falha e nada é gravado.
- [ ] Caso de borda: dois coordenadores reordenam ao mesmo tempo; vale a última gravação e a tela do
      outro atualiza no próximo fetch (sem bloqueio).
- [ ] Caso de borda: projeto novo entra sem ordem e aparece no fim, sem quebrar a numeração.
- [ ] pgTAP: a RPC com usuário de outra empresa e sem permissão (como `authenticated`, lembrando que
      pgTAP como superuser não aplica RLS).

## Dados e contratos

Migration nova:

- `projetos.ordem_prioridade integer null`, sem default; índice parcial por `(empresa_id, ordem_prioridade)`
  onde não é nulo. A view `projetos_safe` (por onde o front lê) passa a expor a coluna.
- RPC `reordenar_projetos(p_ids uuid[]) returns void`.
- `npm run gen:types:local` e commitar o `types.ts` (o job `types-sync` confere).
- Baseline da auditoria do banco sobe em 1 (função `authenticated` nova): atualizar a baseline junto.

Front: `ordem_prioridade` entra no tipo `Projeto`; `CronogramaProjetosTab` ganha o filtro, o selo e o
drag (`@hello-pangea/dnd`, o mesmo do quadro). A matemática de datas continua vindo de `src/lib/cronograma.ts`.

## Plano de implementação

1. Migration + RPC + pgTAP + `gen:types:local`.
2. Ordenação e selo `#n` no cronograma (só leitura), com teste.
3. Filtro **Meus projetos** (`useMinhaPessoa`, `?meus=1`), expansão das disciplinas e estado vazio.
4. Drag para reordenar, ligado à RPC, com atualização otimista e rollback.
5. E2E visual: regenerar a referência do cronograma pelo CI.

## Decisões e riscos

- Decisão de 28/10 (Matheus): filtro dentro de `/projetos/cronograma` e ordem manual do coordenador.
- Premissa: "responsável pelo projeto" = responsável de ao menos uma disciplina, igual ao Meu trabalho
  (default assumido na SPEC 123). Se a VRZ quiser um responsável de projeto separado, vira outro card.
- Risco: `CronogramaProjetosTab` já tem 34 KB. A régua de tamanho de arquivo (`file-size ratchet`)
  pode barrar; extrair o drag e o filtro em arquivos próprios em vez de subir o limite.
