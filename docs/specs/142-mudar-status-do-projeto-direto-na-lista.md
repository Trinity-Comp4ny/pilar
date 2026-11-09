# SPEC: Mudar a coluna do projeto direto na lista

**Data:** 2026-10-28
**Status:** Em implementação (protótipo v1 aprovado em 2026-10-28)
**Autor:** Matheus Rezende
**Módulo:** projetos
**Protótipo:** v1 no Claude Design (https://claude.ai/artifact/CtPyfau47mv6yciByzJdUE), desktop e mobile, aprovado
**Origem:** feedback da VRZ de 16/10/2026 ("colocar tipo um filtro (excel), pra poder clicar e mudar o status mais rápido"). Card BEZ-347 (https://app.clickup.com/t/1dfhfaq7ttm), filho do BEZ-345.

## Problema

Para mudar o status de um projeto, quem gere o escritório precisa abrir o quadro e arrastar o card, ou
abrir o projeto. Na visão Lista, que é a que mostra muitos projetos de uma vez, a coluna "Coluna" é só
texto. A VRZ quer clicar no status da própria linha e trocar, como numa célula de filtro do Excel.

## Objetivo

Na visão Lista, clicar na etapa do projeto abre um menu com todas as etapas e escolher uma move o
projeto, com as mesmas regras do arraste no quadro. Mudar de status sem sair da lista, em dois cliques.

**Fora de escopo:**

- Seleção de várias linhas e mudança em massa (decisão de 28/10: só o clique por linha agora).
- Criar, renomear ou reordenar etapas (continua no quadro).
- Mudar o status de disciplina (já existe o `DisciplinaStatusSelect`).
- Atalho de teclado.

## Requisitos

1. Na visão Lista (desktop), a célula **Coluna** vira um botão com a cor e o nome da etapa e um
   chevron. Quem não pode editar projetos (`can("projetos", "create")` falso) continua vendo texto.
2. O clique abre um menu com busca. Lista as etapas na ordem do quadro, cada uma com a cor, o nome e
   (quando existe) o rótulo do bucket. A etapa atual vem marcada.
3. Escolher uma etapa move o projeto pela mesma regra do arraste (`useProjetoStatusMove`):
   - para `Paralisado` abre o diálogo de pausa com motivo (SPEC 141);
   - de `Paralisado` para outra abre o diálogo de retomada;
   - de `Concluído` para outra pede confirmação e zera `data_final`;
   - qualquer outra grava `etapa_id` e o banco deriva o status.
4. A linha atualiza na hora (otimista) e mostra o toast "Movido para <etapa>". Se o servidor
   recusar, a linha volta ao valor anterior e o toast diz o que houve.
5. Mobile (DataTable em modo card): o toque na etapa abre o mesmo seletor como sheet inferior.
6. Escolher a etapa atual só fecha o menu, sem gravar.
7. A regra de movimento sai do `onDragEnd` e vira uma função única (`moverParaEtapa`), usada pelo
   quadro e pela lista. Não pode existir segunda cópia da regra.

Requisitos não-funcionais:

- **Segurança / RLS:** nenhuma tabela nova. A escrita é o `update` em `projetos` que o quadro já faz;
  a RLS por `empresa_id` e a permissão de editar valem igual.
- **Acessibilidade:** o botão é `button` com `aria-haspopup="listbox"` e nome acessível "Mudar etapa
  de <projeto>"; o menu navega por setas e fecha com Esc.
- **Design system:** `Popover` + `Command` do shadcn, cor só por token, nenhum dropdown nativo do SO.

## Critérios de aceite

- [ ] Dado um usuário que edita projetos, quando clica na etapa de uma linha e escolhe "Em andamento",
      então a linha mostra a nova etapa sem recarregar e aparece o toast de sucesso.
- [ ] Dado um projeto em andamento, quando escolhe `Paralisado`, então abre o diálogo de motivo e nada
      é gravado antes de confirmar; cancelar deixa a linha como estava.
- [ ] Dado um projeto `Paralisado`, quando escolhe outra etapa, então abre o diálogo de retomada.
- [ ] Dado um projeto `Concluído`, quando escolhe outra etapa, então pede confirmação e só zera
      `data_final` depois dela.
- [ ] Dado um usuário sem permissão de editar, então a célula é texto e não abre menu.
- [ ] Dado que o update falha, então a linha volta à etapa anterior e o toast mostra o erro.
- [ ] Caso de borda: escolher a etapa atual não dispara update.
- [ ] Caso de borda: filtro de coluna ativo; o projeto movido para fora do filtro some da lista e o
      toast confirma o destino.
- [ ] Teste de unidade do `moverParaEtapa` cobrindo as quatro regras; teste de componente da célula.

## Dados e contratos

Nenhuma migration, nenhum RPC novo. Mudanças só no front:

- `useProjetoStatusMove`: extrai `moverParaEtapa(projetoId, etapaId)` do `onDragEnd`.
- `ListaProjetos`: recebe `etapas`, `canEdit` e `onMoverEtapa`; nova célula `EtapaSelect`.
- `Projetos.tsx`: passa `onMoverEtapa={moverParaEtapa}` à lista.

## Plano de implementação

1. Extrair `moverParaEtapa` e fazer `onDragEnd` chamá-la; testes de unidade da regra.
2. Criar `EtapaSelect` (Popover + Command) com teste de componente.
3. Ligar na `ListaProjetos` e em `Projetos.tsx`; modo card mobile abre o sheet.
4. E2E visual: regenerar a referência da lista de projetos pelo CI (flag `E2E_VISUAL_ATUALIZAR`).

## Decisões e riscos

- Decisão de 28/10 (Matheus): só o clique por linha; em massa fica para um card futuro se a VRZ pedir.
- Risco: a régua `arquitetura-front.test.ts` e o Knip podem reclamar de export novo; ajustar a baseline
  de propósito, como nas SPECs 140 e 141.
