import { act, render, screen } from "@testing-library/react";
import { domAnimation, LazyMotion } from "framer-motion";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararAmbiente } from "../test/ambiente";
import { MODULOS, type MockNome } from "../lib/modules";
import { ATOS, FRASE, idx } from "./hero/scene";

// Telas vetoriais da landing: cada grupo de módulo tem a sua tela, a cena da hero revela cada
// parte só no ato certo (e a versão de celular conta a mesma história), e a demonstração do
// agente encena os cinco tempos quando entra em vista, ou já nasce no estado final.

const h = vi.hoisted(() => ({ reduzido: false, emVista: false }));
vi.mock("framer-motion", async (orig) => ({
  ...(await orig<typeof import("framer-motion")>()),
  useReducedMotion: () => h.reduzido,
  useInView: () => h.emVista,
}));

import { GroupMock, ModuleScreen } from "./mock/ModuleScreens";
import { TelaFinanceiro, TelaLeads, TelaProjeto } from "./hero/SceneScreens";
import { TelaObra } from "./hero/TelaObra";
import { TelaAgentes } from "./hero/TelaAgentes";
import { HeroSceneMobile } from "./hero/HeroSceneMobile";
import { AgentDemo } from "./agents/AgentDemo";

beforeAll(() => prepararAmbiente());
beforeEach(() => {
  h.reduzido = false;
  h.emVista = false;
});
afterEach(() => vi.useRealTimers());

const comMotion = (ui: ReactNode) => render(<LazyMotion features={domAnimation}>{ui}</LazyMotion>);

describe("telas dos módulos", () => {
  const mocks = [...new Set(MODULOS.flatMap((m) => m.grupos.map((g) => g.mock)))] as MockNome[];

  it("todo grupo de todo módulo aponta para uma tela que renderiza", () => {
    expect(mocks.length).toBeGreaterThan(5);
    for (const mock of mocks) {
      const { container, unmount } = comMotion(<GroupMock mock={mock} />);
      expect(container.textContent!.length, mock).toBeGreaterThan(20);
      unmount();
    }
  });

  it.each([
    "kanban",
    "financeiro",
    "folha",
    "quadro",
    "gantt",
    "parcelas",
    "diario",
    "cotacao",
    "conta-obra",
    "portal-projeto",
    "portal-obra",
    "campo-diario",
    "campo-tarefas",
  ] as MockNome[])("%s tem tela própria", (mock) => {
    const { container } = comMotion(<GroupMock mock={mock} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("cada módulo tem a tela de capa, e slug desconhecido cai no diário", () => {
    const textos = new Set<string>();
    for (const slug of ["gestao", "projetos", "portal", "campo", "obra"] as const) {
      const { container, unmount } = comMotion(<ModuleScreen slug={slug} />);
      textos.add(container.textContent!);
      unmount();
    }
    expect(textos.size).toBe(5);
  });
});

describe("cena da hero, ato a ato", () => {
  const telas = [
    ["TelaAgentes", TelaAgentes],
    ["TelaLeads", TelaLeads],
    ["TelaFinanceiro", TelaFinanceiro],
    ["TelaProjeto", TelaProjeto],
    ["TelaObra", TelaObra],
  ] as const;

  it.each(telas)("%s renderiza em todos os atos e muda ao longo da cena", (_nome, Tela) => {
    const conteudos = new Set<string>();
    for (let ato = 0; ato < ATOS.length; ato++) {
      const { container, unmount } = comMotion(<Tela ato={ato} />);
      conteudos.add(container.innerHTML);
      unmount();
    }
    expect(conteudos.size).toBeGreaterThan(1);
  });

  it("obra mostra o diário do campo só a partir do ato da obra", () => {
    const antes = comMotion(<TelaObra ato={idx("obra") - 1} />);
    const htmlAntes = antes.container.innerHTML;
    antes.unmount();
    const depois = comMotion(<TelaObra ato={idx("obra")} />);
    expect(depois.container.innerHTML).not.toBe(htmlAntes);
    expect(screen.getByText("Bloco cirúrgico, Hospital Santa Rita")).toBeInTheDocument();
  });
});

describe("HeroSceneMobile", () => {
  it("estático mostra o pedido inteiro e o rascunho de cara", () => {
    comMotion(<HeroSceneMobile ato={0} estatico />);
    expect(screen.getByText(FRASE)).toBeInTheDocument();
  });

  it("digita o pedido letra a letra no ato de digitar", () => {
    vi.useFakeTimers();
    const { container } = comMotion(<HeroSceneMobile ato={idx("digita")} estatico={false} />);
    expect(container.textContent).not.toContain(FRASE);
    act(() => vi.advanceTimersByTime(60_000));
    expect(container.textContent).toContain(FRASE);
  });

  it("revela os resultados por ato, até a obra", () => {
    const vistos: string[] = [];
    for (let ato = 0; ato < ATOS.length; ato++) {
      const { container, unmount } = comMotion(<HeroSceneMobile ato={ato} estatico={false} />);
      vistos.push(container.textContent!);
      unmount();
    }
    expect(vistos[idx("pensa")]).toContain(FRASE);
    expect(vistos.at(-1)).toContain("Chegou do campo");
  });
});

describe("AgentDemo", () => {
  const PEDIDO = "Recebi 128 mil do centro cirúrgico, primeira de três parcelas";

  it("fora de vista já mostra o pedido e o rascunho completos (nada em branco)", () => {
    comMotion(<AgentDemo />);
    expect(screen.getByText(PEDIDO)).toBeInTheDocument();
    expect(screen.getByText("R$ 128.400,00")).toBeInTheDocument();
    expect(screen.getByText("Gravado no financeiro")).toBeInTheDocument();
  });

  it("movimento reduzido fica no estado final mesmo em vista", () => {
    h.reduzido = true;
    h.emVista = true;
    comMotion(<AgentDemo />);
    expect(screen.getByText("Gravado no financeiro")).toBeInTheDocument();
  });

  it("em vista encena: digita, pensa, mostra o rascunho, confirma e grava", () => {
    vi.useFakeTimers();
    h.emVista = true;
    const { container } = comMotion(<AgentDemo />);
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    // Digitando: só o começo do pedido.
    act(() => vi.advanceTimersByTime(300));
    const parcial = container.textContent!;
    expect(parcial).toContain("Recebi");
    expect(parcial).not.toContain(PEDIDO);
    act(() => vi.advanceTimersByTime(1500));
    expect(container.textContent).toContain(PEDIDO);
    act(() => vi.advanceTimersByTime(800));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("Gravado no financeiro")).toBeInTheDocument();
  });
});
