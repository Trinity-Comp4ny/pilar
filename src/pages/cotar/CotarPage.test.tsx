import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// SPEC 144: a página pública fala só com a edge `cotacao-link`. Aqui a API é trocada por um dublê.
const consultar = vi.fn();
const enviar = vi.fn();
vi.mock("./cotarApi", () => ({
  consultarCotacao: (...a: unknown[]) => consultar(...a),
  enviarProposta: (...a: unknown[]) => enviar(...a),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import CotarPage from "./CotarPage";

const TOKEN = "xK3v9Qe2mT7pAbCdEfGhIjKlMnOpQrStUvWxYz01234";
const cotacao = {
  empresa_nome: "Alfa Engenharia",
  descricao: "Cimento CP-II 50 kg",
  quantidade: 400,
  unidade: "saco",
  prazo_necessidade: "2026-11-06",
  observacoes: null,
  expira_em: "2026-11-04T15:00:00Z",
  resposta_atual: null,
};

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/cotar/${TOKEN}`]}>
        <Routes>
          <Route path="/cotar/:token" element={<CotarPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe("CotarPage", () => {
  beforeEach(() => {
    consultar.mockReset();
    enviar.mockReset();
  });

  it("consulta pelo token da rota e mostra a cotação sem dado da obra", async () => {
    consultar.mockResolvedValue(cotacao);
    abrir();

    expect(await screen.findByText("Cimento CP-II 50 kg")).toBeInTheDocument();
    expect(consultar).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText(/400 saco/)).toBeInTheDocument();
    expect(screen.getByText(/04\/11\/2026/)).toBeInTheDocument();
  });

  it("link encerrado mostra a mesma mensagem, sem dizer o motivo", async () => {
    consultar.mockResolvedValue(null);
    abrir();

    expect(await screen.findByText("Esta cotação foi encerrada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar proposta" })).not.toBeInTheDocument();
  });

  it("falha de rede oferece tentar de novo", async () => {
    consultar.mockRejectedValue(new Error("Sem conexão com o servidor"));
    abrir();

    expect(await screen.findByText("Não foi possível abrir a cotação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("não envia com campo inválido e diz o que corrigir", async () => {
    consultar.mockResolvedValue(cotacao);
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar proposta" }));

    expect(await screen.findByText("Informe o valor à vista, maior que zero.")).toBeInTheDocument();
    expect(screen.getByText("Informe a condição de pagamento.")).toBeInTheDocument();
    expect(screen.getByText("Informe o prazo em dias, com número inteiro.")).toBeInTheDocument();
    expect(enviar).not.toHaveBeenCalled();
  });

  it("envia a proposta no formato da edge e confirma", async () => {
    consultar.mockResolvedValue(cotacao);
    enviar.mockResolvedValue(true);
    abrir();
    await screen.findByRole("button", { name: "Enviar proposta" });

    preencher("Valor à vista (R$)", "2090000");
    preencher("Condição de pagamento", "30 dias");
    preencher("Desconto (%, opcional)", "3");
    preencher("Prazo de entrega (dias)", "5");
    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith(TOKEN, {
        valor: 20900,
        valor_parcelado: null,
        condicao_pagamento: "30 dias",
        desconto_pct: 3,
        prazo_entrega_dias: 5,
        observacoes: null,
      })
    );
    expect(await screen.findByText("Proposta enviada")).toBeInTheDocument();
  });

  it("volta a preencher com a resposta anterior para corrigir", async () => {
    consultar.mockResolvedValue({
      ...cotacao,
      resposta_atual: {
        valor: 20900,
        valor_parcelado: 21500,
        condicao_pagamento: "30 dias",
        desconto_pct: 3,
        prazo_entrega_dias: 5,
        observacoes: "frete incluso",
      },
    });
    abrir();

    expect(await screen.findByDisplayValue("30 dias")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("frete incluso")).toBeInTheDocument();
  });
});
