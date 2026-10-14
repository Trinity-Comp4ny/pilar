# Acessibilidade: o que o CI cobre e o roteiro manual

O Axe acha uns 30 a 40% dos problemas de acessibilidade: contraste, rótulo faltando, papel
ARIA errado. Ordem de foco, foco preso em modal, anúncio de leitor de tela e uso só com
teclado ele não mede. Este documento separa o que já é automático do que precisa de gente.
← [voltar](./PILAR_DESIGN_SYSTEM.md)

## Automático (reprova o CI)

| Spec                                     | Cobre                                                                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/a11y-app-authenticated.spec.ts`     | 21 telas: início, projetos (quadro, detalhe, disciplinas, cronograma, mapa), lançamentos, financeiro, clientes, leads, propostas, obras (lista, detalhe, fornecedores), tarefas, equipe, metas, agentes, relatórios, administração |
| `e2e/a11y-teclado-authenticated.spec.ts` | skip link leva o foco ao conteúdo; modal prende o foco, Esc fecha e o foco volta ao botão que abriu                                                                                                                                |
| `e2e/a11y-publico.spec.ts`               | login, cadastro, recuperar senha, login do portal do cliente, login do Pilar Campo                                                                                                                                                 |
| `e2e/marketing-a11y.spec.ts`             | site de marketing em produção, com movimento reduzido                                                                                                                                                                              |

Tela nova com rota própria entra na lista do spec correspondente no mesmo PR.

## Roteiro manual

Quando rodar: antes do primeiro cliente pagante, depois a cada trimestre, e sempre que
uma tela das jornadas abaixo mudar de estrutura (não de copy). Leva cerca de 1 hora.

Ferramentas: só teclado, VoiceOver (macOS, Cmd+F5) no Safari, zoom do navegador em 200%.

### 1. Só teclado (sem mouse)

Para cada jornada: login → criar projeto → lançar receita → enviar proposta → aprovar
pelo portal do cliente.

- [ ] Tab percorre na ordem visual; nada focável fica invisível ou atrás de overlay.
- [ ] O foco é sempre visível (anel do token `--ring`).
- [ ] Modal (`FormDialog`, `ConfirmDialog`) prende o foco dentro e Esc fecha.
- [ ] Ao fechar o modal, o foco volta ao botão que abriu.
- [ ] Select, combobox e datepicker abrem e escolhem com setas e Enter.
- [ ] Quadro (kanban) tem caminho por teclado para mudar o status do card (menu do card).
- [ ] O primeiro Tab mostra "Pular para conteúdo principal" (`Layout.tsx`) e ele pula o menu lateral.

### 2. Leitor de tela (VoiceOver)

- [ ] Cada página anuncia um título (`usePageTitle`) e tem um único `h1`.
- [ ] Botão só com ícone anuncia o que faz (rótulo, não "botão").
- [ ] Erro de formulário é anunciado ao salvar e ligado ao campo (`aria-describedby`).
- [ ] Toast de sucesso e de erro é anunciado sem roubar o foco.
- [ ] Status (`StatusBadge`) é lido como texto, não só como cor.
- [ ] Tabela (`DataTable`) anuncia cabeçalho de coluna ao navegar pelas células.
- [ ] Gráfico tem resumo em texto (valor principal) além da imagem.

### 3. Zoom e movimento

- [ ] Zoom de 200%: nenhuma tela das jornadas corta texto ou exige rolagem horizontal
      (exceto tabela larga e quadro, que rolam dentro do próprio contêiner).
- [ ] Movimento reduzido ligado no sistema: animações da marca param ou viram corte
      (ADR 0049).

## Registro

Cada rodada vira uma linha aqui, com o que falhou e o PR que corrigiu.

| Data       | Quem                    | Jornadas                                 | Falhas                                                                                                                                                 | PRs     |
| ---------- | ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 2026-10-14 | Automática (Playwright) | 21 telas no Axe + ciclo de foco do modal | Selects sem nome (5 telas), contraste nas barras do cronograma, rosca sem alternativa, `main` duplicado, foco perdido ao fechar modal, texto em inglês | esta PR |

Rodada manual (VoiceOver, zoom 200%, kanban e Gantt por teclado): ainda não feita.
