# ADR 0055: Hook de um módulo mora no módulo; `src/hooks` é só para o que é compartilhado

**Data:** 2026-10-13  
**Status:** Accepted

## Contexto

A revisão externa do staging (13/10) deu 6,5 para a arquitetura do front, lendo o código como "horizontal" (`src/hooks`, `src/lib`, `src/pages`, `src/components`) em vez de organizado por feature. Medido no código, a leitura era meia verdade: cerca de 70% do front já vive em `src/pages/<modulo>/` (financeiro com 52 arquivos, projetos 45, obras 25), com `components/`, `tabs/` e, no financeiro, `hooks/` próprios.

O que sobrava de horizontal era `src/hooks/`: 69 arquivos, sendo 16 usados só pelo módulo Obras (`useObra*`, `useAlertasClima`, `useTranscreverRdoVoz`). Quem mexe no Obras precisa saber que metade do módulo está em outra pasta, e a cobertura de `src/hooks` misturava hook compartilhado com hook de tela.

- **Mover tudo para `src/features/<modulo>/`**: estrutura "de livro", mas renomeia a árvore inteira, conflita com todo PR aberto e não muda nada que o usuário veja.
- **Manter `src/pages/<modulo>/` como a pasta da feature e trazer os hooks para dentro**: já é o padrão do financeiro, move poucos arquivos por vez e cada módulo migra quando alguém mexer nele.

## Decisão

`src/pages/<modulo>/` é a pasta da feature. Hook usado só por um módulo mora em `src/pages/<modulo>/hooks/`. `src/hooks/` fica para o que é usado por dois módulos ou mais (`usePermissions`, `useFeatureAccess`, `useNotificacoes`...).

Primeiro passo, neste ADR: os 16 hooks do Obras foram para `src/pages/obras/hooks/`. `useFornecedorDetalhe` fica em `src/hooks/` porque `pages/fornecedores` também usa.

Hook novo segue a regra desde já. Os hooks de módulo que ainda estão em `src/hooks/` migram quando o módulo for tocado, num PR próprio (mover e trocar import, sem mudar comportamento).

## Consequências

**Positivas:**

- O módulo fica num lugar só: tela, componente e acesso a dados do Obras estão sob `src/pages/obras/`.
- A cobertura por pasta passa a dizer algo: o piso de `src/pages/obras/**` mede o módulo inteiro, e o de `src/hooks/**` mede só o compartilhado.

**Negativas / custos:**

- A migração é gradual: por um tempo convivem hooks de módulo nos dois lugares.
- Hook que passa a ser usado por um segundo módulo tem que voltar para `src/hooks/` (import cruzado entre `pages/<a>` e `pages/<b>` não é permitido por esta regra).
