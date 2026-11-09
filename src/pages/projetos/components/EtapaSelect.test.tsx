import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EtapaSelect } from "./EtapaSelect";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";

// Feedback da VRZ (16/10, SPEC 142): na Lista a etapa do projeto era só texto; agora o clique
// abre um menu e escolher uma etapa devolve o id, sem abrir o projeto.

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const etapas: ProjetoEtapa[] = [
  { id: "e1", nome: "Briefing", ordem: 1, cor: "#94a3b8", bucket: "Planejamento" },
  { id: "e2", nome: "Em andamento", ordem: 2, cor: "#3b82f6", bucket: "Em andamento" },
  { id: "e3", nome: "Paralisado", ordem: 3, cor: "#ef4444", bucket: "Paralisado" },
];

beforeAll(() => {
  // cmdk (Command) mede a lista com ResizeObserver e rola o item ativo; o jsdom não tem nenhum dos dois.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

const base = { projetoNome: "Residencial Aurora", statusFallback: "Em Andamento", etapas, canEdit: true };

describe("EtapaSelect", () => {
  it("mostra a etapa atual e devolve a etapa escolhida", () => {
    const onSelect = vi.fn();
    render(<EtapaSelect {...base} etapaId="e2" onSelect={onSelect} />);

    const gatilho = screen.getByRole("button", { name: "Mudar etapa de Residencial Aurora" });
    expect(gatilho).toHaveTextContent("Em andamento");

    fireEvent.click(gatilho);
    fireEvent.click(screen.getByRole("option", { name: /Paralisado/ }));

    expect(onSelect).toHaveBeenCalledWith("e3");
  });

  it("escolher a etapa atual só fecha o menu, sem chamar onSelect", () => {
    const onSelect = vi.fn();
    render(<EtapaSelect {...base} etapaId="e2" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Mudar etapa de Residencial Aurora" }));
    fireEvent.click(screen.getByRole("option", { name: /Em andamento/ }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("o clique na etapa não vaza para a linha", () => {
    const onLinha = vi.fn();
    render(
      <div onClick={onLinha}>
        <EtapaSelect {...base} etapaId="e2" onSelect={vi.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Mudar etapa de Residencial Aurora" }));

    expect(onLinha).not.toHaveBeenCalled();
  });

  it("sem permissão de editar mostra só o texto", () => {
    render(<EtapaSelect {...base} canEdit={false} etapaId="e2" onSelect={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Em andamento")).toBeInTheDocument();
  });

  it("projeto sem etapa mostra o status legado", () => {
    render(<EtapaSelect {...base} etapaId={null} statusFallback="Concluído" onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Mudar etapa de Residencial Aurora" })).toHaveTextContent("Concluído");
  });
});
