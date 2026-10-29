import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvaliacoesFornecedor, notaMedia } from "./AvaliacoesFornecedor";
import { type AvaliacaoFornecedor } from "@/hooks/useFornecedorAvaliacoes";

const av = (nota_geral: number | null, extra: Partial<AvaliacaoFornecedor> = {}): AvaliacaoFornecedor => ({
  id: String(Math.random()),
  proposta_id: "p",
  cotacao_id: "c",
  nota_demora: 5,
  nota_preco: null,
  nota_prazo: 4,
  nota_qualidade: null,
  nota_geral,
  comentario: null,
  avaliado_em: "2026-10-28T15:00:00Z",
  cotacao: { descricao: "Cimento CP-II 50 kg", obra: { nome: "Residencial Aurora" } },
  ...extra,
});

describe("notaMedia", () => {
  it("é a média das notas gerais com uma casa e ignora avaliação sem nota", () => {
    expect(notaMedia([av(4.5), av(3.5), av(null)])).toBe(4);
    expect(notaMedia([av(4), av(5), av(5)])).toBe(4.7);
  });

  it("sem avaliação não há nota", () => {
    expect(notaMedia([])).toBeNull();
  });
});

describe("AvaliacoesFornecedor", () => {
  it("sem avaliação orienta o primeiro passo", () => {
    render(<AvaliacoesFornecedor avaliacoes={[]} />);
    expect(screen.getByText("Nenhuma avaliação ainda")).toBeInTheDocument();
  });

  it("mostra cotação, obra, dia, só os critérios preenchidos e o comentário", () => {
    render(<AvaliacoesFornecedor avaliacoes={[av(4.5, { comentario: "Entregou antes do combinado" })]} />);

    expect(screen.getByText("Cimento CP-II 50 kg")).toBeInTheDocument();
    expect(screen.getByText(/Residencial Aurora · 28\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText("4,5")).toBeInTheDocument();
    expect(screen.getByText(/Demora/)).toBeInTheDocument();
    expect(screen.queryByText(/Qualidade/)).not.toBeInTheDocument();
    expect(screen.getByText("Entregou antes do combinado")).toBeInTheDocument();
  });
});
