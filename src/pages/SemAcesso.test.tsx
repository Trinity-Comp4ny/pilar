import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SemAcesso from "./SemAcesso";

const { authState } = vi.hoisted(() => ({
  authState: { profile: null as null | { role: string; empresas?: { nome?: string } } },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));

function renderPage(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <SemAcesso />
    </MemoryRouter>
  );
}

beforeEach(() => {
  authState.profile = { role: "colaborador", empresas: { nome: "Escritório Seed" } };
});

describe("SemAcesso", () => {
  it("explica o recurso bloqueado, o perfil atual e o necessário", () => {
    renderPage("/sem-acesso?recurso=admin_portal");
    expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
    expect(screen.getByText("Colaborador")).toBeInTheDocument();
    expect(screen.getByText("Requer perfil Admin ou Ultra Admin")).toBeInTheDocument();
    expect(screen.getByText("Escritório Seed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/inicio");
  });

  it("recurso financeiro indica a delegação possível", () => {
    renderPage("/sem-acesso?recurso=financeiro");
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText(/acesso financeiro concedido por um administrador/)).toBeInTheDocument();
  });

  it("recurso desconhecido (ou injetado na URL) não é refletido na tela", () => {
    renderPage("/sem-acesso?recurso=<img src=x onerror=alert(1)>");
    expect(screen.getByText("esta página")).toBeInTheDocument();
    expect(screen.getByText("Seu perfil não tem acesso")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("onerror");
  });

  it("sem recurso na URL usa texto genérico", () => {
    renderPage("/sem-acesso");
    expect(screen.getByText("esta página")).toBeInTheDocument();
  });

  it("sem profile mostra 'sem perfil' e omite a empresa", () => {
    authState.profile = null;
    renderPage("/sem-acesso?recurso=pessoas");
    expect(screen.getByText("sem perfil")).toBeInTheDocument();
    expect(screen.queryByText("Empresa")).not.toBeInTheDocument();
  });
});
