import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanCard } from "./PlanCard";
import type { Plan } from "../hooks/usePlans";

// Smoke test: a coluna `features` no banco guarda FeatureKeys (chave estável de
// src/lib/features.ts), não texto de exibição. Sem este teste, um plano com
// features=["dashboard","projetos"] renderizava literalmente "dashboard"/"projetos"
// em vez de "Dashboard"/"Projetos" na vitrine pública.
const basePlan: Plan = {
  id: "1",
  slug: "starter",
  nome: "Essencial",
  descricao: "Pra escritório pequeno",
  preco_mensal: 490,
  preco_anual: 4900,
  max_usuarios: null,
  max_projetos: 15,
  features: ["dashboard", "projetos"],
  destaque: false,
  ordem: 1,
};

function renderCard(plan: Partial<Plan> = {}) {
  return render(
    <MemoryRouter>
      <PlanCard plan={{ ...basePlan, ...plan }} cycle="monthly" />
    </MemoryRouter>
  );
}

describe("PlanCard", () => {
  it("traduz FeatureKeys para o rótulo amigável, não a chave crua", () => {
    renderCard();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });

  it("mostra usuários ilimitados e o limite de projetos ativos", () => {
    renderCard({ max_usuarios: null, max_projetos: 15 });
    expect(screen.getByText(/Usuários ilimitados/)).toBeInTheDocument();
    expect(screen.getByText(/até 15 projetos ativos/)).toBeInTheDocument();
  });

  it("mostra projetos ilimitados quando max_projetos é null", () => {
    renderCard({ max_projetos: null });
    expect(screen.getByText(/projetos ilimitados/)).toBeInTheDocument();
  });

  it("nome e preço mensal aparecem no card", () => {
    renderCard();
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText(/490/)).toBeInTheDocument();
  });
});
