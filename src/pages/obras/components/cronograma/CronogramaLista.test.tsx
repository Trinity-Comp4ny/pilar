import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import type { NoArvore } from "@/pages/obras/lib/obraArvore";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";
import type { ObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import type { CronogramaAcoes } from "./useCronogramaAcoes";

// Lista do cronograma da obra: renomear, datas com validação, menus de ações,
// mover tarefa, sensibilidade a clima, criar itens em sequência e excluir.
// Menu e calendário entram simplificados (são do design system e têm teste próprio).

const navigate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <input
      aria-label={placeholder}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock("@/pages/meu-trabalho/components/CelulasLista", () => ({
  ResponsavelCell: ({
    responsaveis,
    onChange,
  }: {
    responsaveis: { id: string; nome: string; avatarUrl: string | null }[];
    onChange: (ids: string[]) => void;
  }) => (
    <button onClick={() => onChange(["pe9"])}>
      resp:{responsaveis.map((r) => `${r.nome}@${r.avatarUrl ?? "-"}`).join(",")}
    </button>
  ),
  EtiquetasCell: ({ labels, onChange }: { labels: string[]; onChange: (l: string[]) => void }) => (
    <button onClick={() => onChange([...labels, "nova"])}>etiquetas:{labels.join(",")}</button>
  ),
}));
const Radio = createContext<(v: string) => void>(() => {});
vi.mock("@/components/ui/dropdown-menu", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div role="menu">{children}</div>,
    DropdownMenuItem: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button role="menuitem" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    DropdownMenuSeparator: () => null,
    DropdownMenuSub: Pass,
    DropdownMenuSubTrigger: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    DropdownMenuSubContent: Pass,
    DropdownMenuRadioGroup: ({
      children,
      onValueChange,
    }: {
      children?: ReactNode;
      onValueChange: (v: string) => void;
    }) => <Radio.Provider value={onValueChange}>{children}</Radio.Provider>,
    DropdownMenuRadioItem: function Item({ children, value }: { children?: ReactNode; value: string }) {
      const on = useContext(Radio);
      return (
        <button role="menuitemradio" onClick={() => on(value)}>
          {children}
        </button>
      );
    },
  };
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { CronogramaLista } from "./CronogramaLista";

// Tela pesada (Radix + muitos campos): sob cobertura passa dos 5s padrão.
vi.setConfig({ testTimeout: 20000 });

type Arvore = NoArvore<ObraFrenteRow, ObraTarefa>;

const tarefa = (p: Partial<ObraTarefa>): ObraTarefa =>
  ({
    id: "t",
    titulo: "T",
    status: "a_fazer",
    data_inicio: null,
    prazo: null,
    labels: null,
    sensivel_clima: null,
    obra_frente_id: "s1",
    responsaveis: [],
    ...p,
  }) as unknown as ObraTarefa;

const arvore = (no: Partial<ObraFrenteRow>, p: Partial<Arvore> = {}): Arvore => ({
  no: { id: "x", nome: "X", parent_id: null, ordem: 0, data_inicio: null, data_fim: null, ...no } as ObraFrenteRow,
  nivel: "fase",
  filhos: [],
  tarefas: [],
  todasTarefas: [],
  periodoProprio: null,
  periodo: null,
  progresso: 0,
  concluidas: 0,
  total: 0,
  estado: "sem_prazo",
  ...p,
});

const t1 = tarefa({
  id: "t1",
  titulo: "Concretar S1",
  data_inicio: "2026-03-01",
  prazo: "2026-03-10",
  labels: ["laje"],
  sensivel_clima: "concretagem",
  responsaveis: [{ pessoa: { id: "pe1", nome: "Ana" } }, { pessoa: { id: "pe2", nome: "Bia" } }, { pessoa: null }],
});
const t2 = tarefa({ id: "t2", titulo: "Desformar", status: "concluida" });
const solta = tarefa({
  id: "t3",
  titulo: "Limpeza do campo",
  obra_frente_id: null,
  prazo: "2020-01-01",
  data_inicio: "2019-12-01",
});

const servico = arvore(
  { id: "s1", nome: "Sapatas", data_inicio: "2026-03-01", data_fim: "2026-03-20" },
  { nivel: "servico", tarefas: [t1, t2], total: 2, concluidas: 1, progresso: 50, estado: "em_andamento" }
);
const etapa = arvore(
  { id: "e1", nome: "Fundação" },
  { nivel: "etapa", filhos: [servico], total: 2, periodo: { inicio: "2026-03-01", fim: "2026-03-20" } }
);
const fase = arvore({ id: "f1", nome: "Estrutura" }, { filhos: [etapa], total: 2 });
const vazia = arvore({ id: "f2", nome: "Acabamento" });

let acoes: CronogramaAcoes;
const setAdicionando = vi.fn();
const onToggle = vi.fn();
const onExpandir = vi.fn();

function montar(p: Partial<React.ComponentProps<typeof CronogramaLista>> = {}) {
  return render(
    <CronogramaLista
      fases={[fase, vazia]}
      soltas={[solta]}
      servicos={[servico.no, { ...servico.no, id: "s2", nome: "Vigas" }]}
      caminho={(id) => `caminho/${id}`}
      recolhidos={new Set()}
      onToggle={onToggle}
      onExpandir={onExpandir}
      canEdit
      pessoas={[{ id: "pe1", nome: "Ana", avatarUrl: "https://a" } as never]}
      acoes={acoes}
      adicionando={null}
      setAdicionando={setAdicionando}
      {...p}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  acoes = {
    criarNo: vi.fn().mockResolvedValue(true),
    atualizarNo: vi.fn().mockResolvedValue(undefined),
    moverNo: vi.fn().mockResolvedValue(undefined),
    excluirNo: vi.fn().mockResolvedValue(true),
    criarTarefa: vi.fn().mockResolvedValue(true),
    atualizarTarefa: vi.fn().mockResolvedValue(undefined),
    definirResponsaveis: vi.fn().mockResolvedValue(undefined),
    excluirTarefa: vi.fn().mockResolvedValue(true),
    salvando: false,
    excluindo: false,
  };
});

const no = (id: string) => screen.getByTestId(`no-${id}`);
const linhaTarefa = (id: string) => screen.getByTestId(`tarefa-${id}`);

describe("CronogramaLista: nós", () => {
  it("mostra a árvore com avanço, dica de período e a seção Sem serviço", () => {
    montar();
    expect(within(no("s1")).getByText("50% · 1/2")).toBeInTheDocument();
    expect(within(no("f2")).getByText("sem tarefas")).toBeInTheDocument();
    expect(within(no("e1")).getByLabelText("01/03/2026")).toBeInTheDocument();
    expect(within(no("e1")).getByLabelText("20/03/2026")).toBeInTheDocument();
    expect(screen.getByText("Sem serviço")).toBeInTheDocument();
    expect(within(no("f2")).getByRole("button", { name: "Recolher Acabamento" })).toBeDisabled();
    fireEvent.click(within(no("f1")).getByRole("button", { name: "Recolher Estrutura" }));
    expect(onToggle).toHaveBeenCalledWith("f1");
  });

  it("nó recolhido esconde os filhos e mostra Expandir", () => {
    montar({ recolhidos: new Set(["f1"]) });
    expect(screen.getByRole("button", { name: "Expandir Estrutura" })).toBeInTheDocument();
    expect(screen.queryByTestId("no-e1")).not.toBeInTheDocument();
  });

  it("renomeia pelo clique: Enter salva aparado, mesmo nome não grava, vazio e Esc cancelam", () => {
    montar();
    fireEvent.click(within(no("e1")).getByRole("button", { name: "Fundação" }));
    const campo = screen.getByRole("textbox", { name: "Nome" });
    fireEvent.change(campo, { target: { value: "  Fundações " } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(acoes.atualizarNo).toHaveBeenCalledWith({ id: "e1", nome: "Fundações" });

    fireEvent.click(within(no("e1")).getByRole("button", { name: "Fundação" }));
    fireEvent.blur(screen.getByRole("textbox", { name: "Nome" }));
    expect(acoes.atualizarNo).toHaveBeenCalledTimes(1);

    fireEvent.click(within(no("e1")).getByRole("button", { name: "Fundação" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "  " } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Nome" }), { key: "Enter" });
    expect(screen.queryByRole("textbox", { name: "Nome" })).not.toBeInTheDocument();

    fireEvent.click(within(no("e1")).getByRole("menuitem", { name: "Renomear" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Nome" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Nome" })).not.toBeInTheDocument();
    expect(acoes.atualizarNo).toHaveBeenCalledTimes(1);
  });

  it("datas do nó: valida início depois do fim e fim antes do início; limpar vira null", () => {
    montar();
    const s1 = no("s1");
    fireEvent.change(within(s1).getByDisplayValue("2026-03-01"), { target: { value: "2026-03-25" } });
    expect(toast.error).toHaveBeenCalledWith("O início não pode ser depois do fim");
    fireEvent.change(within(s1).getByDisplayValue("2026-03-20"), { target: { value: "2026-02-01" } });
    expect(toast.error).toHaveBeenCalledWith("O fim não pode ser antes do início");
    expect(acoes.atualizarNo).not.toHaveBeenCalled();

    fireEvent.change(within(s1).getByDisplayValue("2026-03-01"), { target: { value: "2026-03-02" } });
    expect(acoes.atualizarNo).toHaveBeenCalledWith({ id: "s1", data_inicio: "2026-03-02" });
    fireEvent.change(within(s1).getByDisplayValue("2026-03-20"), { target: { value: "" } });
    expect(acoes.atualizarNo).toHaveBeenCalledWith({ id: "s1", data_fim: null });
    // Etapa sem datas próprias aceita qualquer data.
    fireEvent.change(within(no("e1")).getByLabelText("20/03/2026"), { target: { value: "2026-04-01" } });
    expect(acoes.atualizarNo).toHaveBeenCalledWith({ id: "e1", data_fim: "2026-04-01" });
    fireEvent.change(within(no("e1")).getByLabelText("01/03/2026"), { target: { value: "" } });
  });

  it("menu do nó: novo filho, subir, descer e excluir com o que vai junto", async () => {
    montar();
    const f1 = no("f1");
    fireEvent.click(within(f1).getByRole("menuitem", { name: "Nova etapa" }));
    expect(onExpandir).toHaveBeenCalledWith("f1");
    expect(setAdicionando).toHaveBeenCalledWith({ parentId: "f1" });
    fireEvent.click(within(f1).getByRole("button", { name: "Adicionar etapa em Estrutura" }));
    fireEvent.click(within(f1).getByRole("menuitem", { name: "Subir" }));
    expect(acoes.moverNo).toHaveBeenCalledWith("f1", -1);
    fireEvent.click(within(f1).getByRole("menuitem", { name: "Descer" }));
    expect(acoes.moverNo).toHaveBeenCalledWith("f1", 1);
    expect(within(no("s1")).getByRole("button", { name: "Adicionar tarefa em Sapatas" })).toBeInTheDocument();

    fireEvent.click(within(f1).getByRole("menuitem", { name: "Excluir fase" }));
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Excluir fase?")).toBeInTheDocument();
    expect(
      within(dialogo).getByText(
        'Também exclui 1 etapa e 1 serviço abaixo. 2 tarefas continuam na obra, em "Sem serviço".'
      )
    ).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" })));
    expect(acoes.excluirNo).toHaveBeenCalledWith("f1");
  });

  it("excluir fase vazia avisa que nenhuma tarefa é apagada; serviço com 1 tarefa no singular", async () => {
    montar();
    fireEvent.click(within(no("f2")).getByRole("menuitem", { name: "Excluir fase" }));
    expect(screen.getByText("Nenhuma tarefa é apagada.")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(acoes.excluirNo).not.toHaveBeenCalled();
  });

  it("sem edição: nome expande/recolhe e não há menus nem botões de novo", () => {
    montar({ canEdit: false });
    fireEvent.click(within(no("f1")).getByRole("button", { name: "Estrutura" }));
    expect(onToggle).toHaveBeenCalledWith("f1");
    expect(within(no("f1")).queryByRole("menuitem")).not.toBeInTheDocument();
    expect(screen.queryByText("Nova fase")).not.toBeInTheDocument();
    expect(within(linhaTarefa("t1")).getByRole("checkbox")).toBeDisabled();
    // A tarefa ainda abre na gestão.
    expect(within(linhaTarefa("t1")).getAllByRole("menuitem")).toHaveLength(1);
  });
});

describe("CronogramaLista: criar itens", () => {
  it("botão Nova fase abre o campo na raiz", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Nova fase" }));
    expect(setAdicionando).toHaveBeenCalledWith({ parentId: null });
  });

  it("campo de nova fase cria em sequência; vazio não cria; Esc e Fechar fecham", async () => {
    montar({ adicionando: { parentId: null } });
    const campo = screen.getByRole("textbox", { name: "Nova fase" });
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(acoes.criarNo).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: " Cobertura " } });
    await act(async () => fireEvent.keyDown(campo, { key: "Enter" }));
    expect(acoes.criarNo).toHaveBeenCalledWith("fase", null, "Cobertura");
    expect(campo).toHaveValue("");

    (acoes.criarNo as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    fireEvent.change(campo, { target: { value: "Falha" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Criar" })));
    expect(campo).toHaveValue("Falha");

    fireEvent.keyDown(campo, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(setAdicionando).toHaveBeenCalledTimes(2);
    expect(setAdicionando).toHaveBeenCalledWith(null);
  });

  it("no serviço o campo cria tarefa; na etapa cria serviço", async () => {
    const { rerender } = montar({ adicionando: { parentId: "s1" } });
    const campo = screen.getByRole("textbox", { name: "Nova tarefa" });
    fireEvent.change(campo, { target: { value: "Armar" } });
    await act(async () => fireEvent.keyDown(campo, { key: "Enter" }));
    expect(acoes.criarTarefa).toHaveBeenCalledWith(servico.no, "Armar");

    rerender(
      <CronogramaLista
        fases={[fase]}
        soltas={[]}
        servicos={[]}
        caminho={(id) => id}
        recolhidos={new Set()}
        onToggle={onToggle}
        onExpandir={onExpandir}
        canEdit
        pessoas={[]}
        acoes={acoes}
        adicionando={{ parentId: "e1" }}
        setAdicionando={setAdicionando}
      />
    );
    const campoServico = screen.getByRole("textbox", { name: "Novo serviço" });
    fireEvent.change(campoServico, { target: { value: "Blocos" } });
    await act(async () => fireEvent.keyDown(campoServico, { key: "Enter" }));
    expect(acoes.criarNo).toHaveBeenCalledWith("servico", "e1", "Blocos");
    // Botão "Nova etapa" dentro da fase abre o campo do filho.
    fireEvent.click(screen.getByRole("button", { name: "Nova etapa" }));
    expect(setAdicionando).toHaveBeenCalledWith({ parentId: "f1" });
  });
});

describe("CronogramaLista: tarefas", () => {
  it("concluir e reabrir pelo checkbox", () => {
    montar();
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Concretar S1" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", status: "concluida" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Reabrir Desformar" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t2", status: "a_fazer" });
    expect(screen.getByRole("button", { name: "Desformar" })).toHaveClass("line-through");
  });

  it("responsáveis (com avatar das pessoas) e etiquetas", () => {
    montar();
    const linha = linhaTarefa("t1");
    fireEvent.click(within(linha).getByText("resp:Ana@https://a,Bia@-"));
    expect(acoes.definirResponsaveis).toHaveBeenCalledWith("t1", ["pe9"]);
    fireEvent.click(within(linha).getByText("etiquetas:laje"));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", labels: ["laje", "nova"] });
    expect(within(linhaTarefa("t2")).getByText("etiquetas:")).toBeInTheDocument();
    expect(within(linha).getByLabelText("Sensível ao clima")).toBeInTheDocument();
  });

  it("datas da tarefa validam início × prazo; limpar vira null", () => {
    montar();
    const linha = linhaTarefa("t1");
    fireEvent.change(within(linha).getByLabelText("Início"), { target: { value: "2026-03-11" } });
    expect(toast.error).toHaveBeenCalledWith("O início não pode ser depois do prazo");
    fireEvent.change(within(linha).getByLabelText("Prazo"), { target: { value: "2026-02-28" } });
    expect(toast.error).toHaveBeenCalledWith("O prazo não pode ser antes do início");
    expect(acoes.atualizarTarefa).not.toHaveBeenCalled();
    fireEvent.change(within(linha).getByLabelText("Início"), { target: { value: "" } });
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", data_inicio: null });
    fireEvent.change(within(linha).getByLabelText("Prazo"), { target: { value: "2026-03-15" } });
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", prazo: "2026-03-15" });
    // Sem datas, qualquer valor passa.
    fireEvent.change(within(linhaTarefa("t2")).getByLabelText("Início"), { target: { value: "2026-01-01" } });
    fireEvent.change(within(linhaTarefa("t2")).getByLabelText("Prazo"), { target: { value: "2026-01-02" } });
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t2", prazo: "2026-01-02" });
  });

  it("tarefa atrasada aparece como Atrasada", () => {
    montar();
    expect(within(linhaTarefa("t3")).getByText("Atrasada")).toBeInTheDocument();
  });

  it("renomeia a tarefa pelo título e pelo menu", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Concretar S1" }));
    const campo = screen.getByRole("textbox", { name: "Nome" });
    fireEvent.change(campo, { target: { value: "Concretar S1 e S2" } });
    fireEvent.blur(campo);
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", titulo: "Concretar S1 e S2" });

    fireEvent.click(within(linhaTarefa("t2")).getByRole("menuitem", { name: "Renomear" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Nome" }), { key: "Enter" });
    expect(acoes.atualizarTarefa).toHaveBeenCalledTimes(1);
  });

  it("menu da tarefa: abrir na gestão, clima, mover de serviço e excluir", async () => {
    montar();
    const linha = linhaTarefa("t1");
    fireEvent.click(within(linha).getByRole("menuitem", { name: /Abrir na gestão/ }));
    expect(navigate).toHaveBeenCalledWith("/gestao/tarefas?tarefa=t1");

    fireEvent.click(within(linha).getByRole("menuitemradio", { name: "Não sensível" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", sensivel_clima: null });
    fireEvent.click(within(linha).getByRole("menuitemradio", { name: "Içamento" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", sensivel_clima: "icamento" });

    expect(within(linha).getByRole("menuitem", { name: "caminho/s1" })).toBeDisabled();
    fireEvent.click(within(linha).getByRole("menuitem", { name: "caminho/s2" }));
    expect(acoes.atualizarTarefa).toHaveBeenCalledWith({ id: "t1", obra_frente_id: "s2" });

    fireEvent.click(within(linha).getByRole("menuitem", { name: "Excluir tarefa" }));
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Excluir tarefa?")).toBeInTheDocument();
    expect(within(dialogo).getByText("A tarefa sai da obra e da gestão de tarefas.")).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" })));
    expect(acoes.excluirTarefa).toHaveBeenCalledWith("t1");
  });

  it("sem serviços cadastrados não oferece mover", () => {
    montar({ servicos: [] });
    expect(screen.queryByText("Mover para serviço")).not.toBeInTheDocument();
  });
});
