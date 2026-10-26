import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResumoDia } from "@/pages/obras/lib/resumoDia";
import { ResumoDoDia } from "./ResumoDoDia";

const base: ResumoDia = {
  prontos: 3,
  pendentes: 0,
  fechados: 0,
  efetivoTotal: 8,
  equipes: [
    { nome: "Pedreiros", quantidade: 6 },
    { nome: "Eletricistas", quantidade: 2 },
  ],
  avancos: ["Reboco (avançou)", "Contrapiso (concluiu)", "Pintura (começou)", "Forro (parou)"],
  ocorrencias: ["Chuva parou a laje"],
  pendencias: [],
  materiaisFaltando: ["Cimento"],
};

describe("ResumoDoDia", () => {
  it("mostra o que o dia somou e limita cada linha a 3 itens", () => {
    render(<ResumoDoDia resumo={base} canEdit onFechar={() => {}} />);
    expect(screen.getByText(/8 pessoas \(Pedreiros 6, Eletricistas 2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Reboco \(avançou\); Contrapiso \(concluiu\); Pintura \(começou\)/)).toBeInTheDocument();
    expect(screen.getByText(/e mais 1/)).toBeInTheDocument();
    expect(screen.getByText("Montado a partir de 3 registros.")).toBeInTheDocument();
    expect(screen.queryByText(/Pendências/)).not.toBeInTheDocument();
  });

  it("o botão fecha o dia", () => {
    const onFechar = vi.fn();
    render(<ResumoDoDia resumo={base} canEdit onFechar={onFechar} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar e fechar o RDO" }));
    expect(onFechar).toHaveBeenCalledOnce();
  });

  it("sem permissão de edição não mostra o botão", () => {
    render(<ResumoDoDia resumo={base} canEdit={false} onFechar={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("com todos os registros já ligados a um RDO oferece abrir o RDO", () => {
    render(<ResumoDoDia resumo={{ ...base, fechados: 3 }} canEdit onFechar={() => {}} />);
    expect(screen.getByRole("button", { name: "Abrir o RDO" })).toBeInTheDocument();
  });

  it("sem registro pronto avisa que a IA ainda organiza", () => {
    render(
      <ResumoDoDia
        resumo={{
          ...base,
          prontos: 0,
          pendentes: 2,
          efetivoTotal: null,
          equipes: [],
          avancos: [],
          ocorrencias: [],
          materiaisFaltando: [],
        }}
        canEdit
        onFechar={() => {}}
      />
    );
    expect(screen.getByText(/Os registros ainda estão sendo organizados\. 2 em organização\./)).toBeInTheDocument();
  });

  it("singular com um registro e uma pessoa", () => {
    render(<ResumoDoDia resumo={{ ...base, prontos: 1, efetivoTotal: 1, equipes: [] }} canEdit onFechar={() => {}} />);
    expect(screen.getByText("Montado a partir de 1 registro.")).toBeInTheDocument();
    expect(screen.getByText(/1 pessoa$/)).toBeInTheDocument();
  });
});
