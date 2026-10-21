import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HeroInicio, type ResumoView } from "./HeroInicio";
import { saudacao } from "./saudacao";
import type { ResumoSemanal } from "@/pages/inicio/hooks/useResumoSemanal";

// Quarta-feira, 15/10/2026, 14h.
const TARDE = new Date(2026, 9, 15, 14, 0, 0);

const resumoIa: ResumoSemanal = {
  escopo: "empresa",
  origem: "ia",
  motivo: null,
  geradoEm: "2026-10-15T12:00:00.000Z",
  conteudo: {
    manchete: "3 projetos atrasados e R$ 15.000 a receber em atraso.",
    destaques: [
      { tom: "atencao", texto: "R$ 15.000 a receber em atraso" },
      { tom: "positivo", texto: "5 disciplinas entregues" },
    ],
  },
};

const view = (mudar: Partial<ResumoView> = {}): ResumoView => ({
  estado: "pronto",
  resumo: resumoIa,
  erro: null,
  onTentarDeNovo: vi.fn(),
  ...mudar,
});

const props = (mudar: Partial<React.ComponentProps<typeof HeroInicio>> = {}) => ({
  nome: "Ana",
  tema: "verde" as const,
  mostrarResumo: true,
  editando: false,
  acoes: null,
  resumo: view(),
  onTema: vi.fn(),
  onMostrarResumo: vi.fn(),
  agora: TARDE,
  ...mudar,
});

describe("saudação", () => {
  it("troca pela hora", () => {
    expect(saudacao(new Date(2026, 9, 15, 8))).toBe("Bom dia");
    expect(saudacao(new Date(2026, 9, 15, 14))).toBe("Boa tarde");
    expect(saudacao(new Date(2026, 9, 15, 21))).toBe("Boa noite");
  });
});

describe("HeroInicio", () => {
  it("mostra a saudação, uma frase e os destaques, e nada além disso", () => {
    render(<HeroInicio {...props()} />);
    expect(screen.getByRole("heading", { name: /Boa tarde, Ana/ })).toBeInTheDocument();
    expect(screen.getByText("3 projetos atrasados e R$ 15.000 a receber em atraso.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Sem data, sem lista de ações, sem rodapé, sem botão de atualizar.
    expect(screen.queryByText(/Por onde começar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Atualizar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/semana de/i)).not.toBeInTheDocument();
  });

  it("o tom do destaque também chega a quem usa leitor de tela", () => {
    render(<HeroInicio {...props()} />);
    expect(screen.getByText(/Atenção:/)).toHaveClass("sr-only");
    expect(screen.getByText(/Positivo:/)).toHaveClass("sr-only");
  });

  it("sem nome, a saudação não deixa vírgula solta", () => {
    render(<HeroInicio {...props({ nome: null })} />);
    expect(screen.getByRole("heading", { name: /^Boa tarde/ }).textContent).not.toContain(",");
  });

  it("resumo automático mostra o motivo, que traz o próximo passo", () => {
    render(
      <HeroInicio
        {...props({
          resumo: view({
            resumo: { ...resumoIa, origem: "automatico", motivo: "Os tokens de IA da empresa acabaram neste ciclo." },
          }),
        })}
      />
    );
    expect(screen.getByText("Os tokens de IA da empresa acabaram neste ciclo.")).toBeInTheDocument();
    expect(screen.getByText("Resumo automático")).toBeInTheDocument();
  });

  it("resumo da IA não repete explicação nenhuma", () => {
    render(<HeroInicio {...props()} />);
    expect(screen.getByText("Resumo escrito por IA")).toBeInTheDocument();
  });

  it("enquanto gera, avisa e não mostra texto antigo", () => {
    render(<HeroInicio {...props({ resumo: view({ estado: "gerando", resumo: null }) })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando o resumo da semana");
  });

  it("em erro, mostra a mensagem e deixa tentar de novo", () => {
    const onTentarDeNovo = vi.fn();
    render(
      <HeroInicio
        {...props({
          resumo: view({
            estado: "erro",
            resumo: null,
            erro: "Não foi possível gerar o resumo agora.",
            onTentarDeNovo,
          }),
        })}
      />
    );
    expect(screen.getByText("Não foi possível gerar o resumo agora.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onTentarDeNovo).toHaveBeenCalledOnce();
  });

  it("com o resumo oculto, só a saudação aparece", () => {
    render(<HeroInicio {...props({ mostrarResumo: false })} />);
    expect(screen.getByRole("heading", { name: /Boa tarde, Ana/ })).toBeInTheDocument();
    expect(screen.queryByText(/projetos atrasados/)).not.toBeInTheDocument();
  });

  it("as ações do painel só aparecem ao personalizar, junto das cores e da exibição", () => {
    const onTema = vi.fn();
    const onMostrarResumo = vi.fn();
    const { rerender } = render(<HeroInicio {...props({ acoes: <button type="button">Salvar painel</button> })} />);
    expect(screen.queryByRole("radiogroup", { name: "Cor do cabeçalho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar painel" })).not.toBeInTheDocument();

    rerender(
      <HeroInicio
        {...props({ editando: true, acoes: <button type="button">Salvar painel</button>, onTema, onMostrarResumo })}
      />
    );
    expect(screen.getByRole("button", { name: "Salvar painel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Grafite" }));
    expect(onTema).toHaveBeenCalledWith("grafite");
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar resumo da semana" }));
    expect(onMostrarResumo).toHaveBeenCalledWith(false);
  });

  it("cada tema aplica a própria superfície", () => {
    const { container, rerender } = render(<HeroInicio {...props({ tema: "grafite" })} />);
    expect(container.querySelector("section")).toHaveClass("bg-gradient-primary", "text-white");
    rerender(<HeroInicio {...props({ tema: "verde" })} />);
    expect(container.querySelector("section")).toHaveClass("bg-brand-soft");
  });
});
