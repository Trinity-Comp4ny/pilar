/** `ou`: teclas alternativas (← ou →). Sem `ou`: combinação apertada junto (⌘ + K). */
export type Atalho = { teclas: string[]; descricao: string; ou?: boolean };
export type GrupoDeAtalhos = { titulo: string; atalhos: Atalho[] };

/**
 * Conteúdo do painel "Atalhos de teclado" (tecla "?"). Só atalhos que existem no
 * código; ao criar ou remover um, atualize aqui:
 * - ⌘K / Ctrl+K: useCommandPalette
 * - ⌘B / Ctrl+B: ui/sidebar (SIDEBAR_KEYBOARD_SHORTCUT)
 * - "?": useAtalhosTeclado
 * - "/" e Esc na busca: PageHeader
 * - setas, Home e End nas abas: SectionTabs
 * - Enter/Espaço na linha: DataTable (onRowClick)
 * - Esc no arraste do cronograma: gantt/useGanttDrag
 *
 * `mod` é o rótulo da tecla modificadora da plataforma (teclaModificadora()).
 */
export function gruposDeAtalhos(mod: string): GrupoDeAtalhos[] {
  return [
    {
      titulo: "Geral",
      atalhos: [
        { teclas: [mod, "K"], descricao: "Abrir a paleta de comandos" },
        { teclas: [mod, "B"], descricao: "Recolher ou expandir o menu lateral" },
        { teclas: ["?"], descricao: "Mostrar estes atalhos" },
        { teclas: ["Esc"], descricao: "Fechar janela ou painel aberto" },
      ],
    },
    {
      titulo: "Busca da página",
      atalhos: [
        { teclas: ["/"], descricao: "Ir para a busca" },
        { teclas: ["Esc"], descricao: "Limpar a busca" },
      ],
    },
    {
      titulo: "Listas e abas",
      atalhos: [
        { teclas: ["←", "→"], descricao: "Trocar de aba", ou: true },
        { teclas: ["Home", "End"], descricao: "Primeira ou última aba", ou: true },
        { teclas: ["Enter", "Espaço"], descricao: "Abrir a linha em foco", ou: true },
      ],
    },
    {
      titulo: "Cronograma",
      atalhos: [{ teclas: ["Esc"], descricao: "Cancelar o arraste de uma barra" }],
    },
  ];
}
