import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const perms = vi.hoisted(() => ({ ocultos: new Set<string>(), pode: true }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => perms.pode, moduloVisivel: (id: string) => !perms.ocultos.has(id) }),
}));

import { FeatureRoute } from "./FeatureRoute";

function montar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route element={<FeatureRoute feature="obras" />}>
          <Route path="/obras" element={<p>tela de obras</p>} />
        </Route>
        <Route path="/projetos" element={<p>tela de projetos</p>} />
        <Route path="/inicio" element={<p>inicio</p>} />
        <Route path="/sem-acesso" element={<p>sem acesso</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  perms.ocultos = new Set();
  perms.pode = true;
});

describe("FeatureRoute", () => {
  it("libera a rota quando o módulo está visível e há acesso", () => {
    montar("/obras");
    expect(screen.getByText("tela de obras")).toBeInTheDocument();
  });

  it("módulo oculto redireciona para o Início", () => {
    perms.ocultos = new Set(["obras"]);
    montar("/obras");
    expect(screen.getByText("inicio")).toBeInTheDocument();
  });

  it("sem acesso à feature manda para /sem-acesso", () => {
    perms.pode = false;
    montar("/obras");
    expect(screen.getByText("sem acesso")).toBeInTheDocument();
  });
});
