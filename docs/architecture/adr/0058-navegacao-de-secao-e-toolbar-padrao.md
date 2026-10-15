# ADR 0058: Navegação de seção horizontal e toolbar padrão sob o header

**Data:** 2026-10-15
**Status:** Accepted

## Contexto

O app tem rail de módulos e painel do módulo (`AppSidebar`). Dentro da página, cada tela
resolveu "seções" e "filtros" por conta própria (levantamento na
[SPEC 121](../../specs/121-padronizacao-de-navegacao-filtros-e-tabelas.md)). Financeiro,
Admin e detalhe de Projeto usam uma sidebar vertical (`SecondSidebar`); Obra, Cliente e
Fornecedor usam abas horizontais. Filtros ficam em 6 lugares e 5 formatos.

Opções para a navegação de seção:

- **A. Sidebar vertical de página**: bom para muitos itens, mas soma uma 3ª coluna (240px)
  ao rail e ao painel do módulo, e a Carteira ainda abre uma 4ª.
- **B. Itens de seção no painel do módulo (`AppSidebar`)**: coerente com Projetos/
  Disciplinas/Cronograma, mas não serve para seções de entidade (Obra, Cliente), que
  precisam de aba por registro.
- **C. Abas horizontais sob o header**: mesma peça para módulo e entidade, devolve 240px
  de largura, já é o padrão de Obra.

Opções para os filtros: dentro dos 56px do header, ou em faixa própria sob o header. O
header já tem título, busca e ação primária, e Projetos já estourou em 390px quando
recebeu filtros ali (auditoria mobile de 08/09).

## Decisão

1. Seção de página é **`SectionTabs`** (opção C), no slot `tabs` do `PageLayout`/`PilarPage`.
   Estilo de sublinhado, sem pílula cinza. `SecondSidebar` é aposentado e removido quando o
   último consumidor migrar.
2. Filtros e seletor de visão vivem numa **toolbar sticky** (slot `toolbar`) logo abaixo
   das abas, dentro do mesmo bloco sticky do header. Busca e ação primária continuam no
   header.
3. Ordem vertical fixa: header, chips mobile do módulo, abas, toolbar, conteúdo.
4. Troca de visão da mesma coleção usa **`ViewSwitcher`**. Filtros usam as peças de
   `src/components/filters/` (`h-9 rounded-full`). Estado ativo é `bg-brand text-ink`
   (verde só como fundo, regra de contraste da marca).
5. Guardas por teste de varredura e ESLint impedem voltar ao padrão antigo.

## Consequências

**Positivas:**

- Uma resposta para "onde fica a seção" e "onde ficam os filtros" em toda página.
- Mais largura útil (sem a 3ª coluna) e menos código por tela.
- Mudar o visual das abas ou dos filtros vira edição de um arquivo.

**Negativas:**

- O bloco sticky ocupa ~150px de altura quando tem abas e toolbar.
- Abas horizontais suportam menos itens que a sidebar: acima de ~7 itens, rolam. As telas
  atuais têm no máximo 7.
- Toda tela migrada muda de aparência e exige nova referência do teste visual E2E.

## Decisões relacionadas

- ADR 0008: regra dos 3 usos e primitivas do DS.
- ADR 0020 e SPEC 041: `DataTable` como tabela padrão.
- SPEC 121: levantamento e plano por fases.
