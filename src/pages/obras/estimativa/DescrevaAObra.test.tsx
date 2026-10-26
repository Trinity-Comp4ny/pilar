import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fichaInicial } from "@/lib/estimativaObra";
import type { Interpretacao } from "./interpretacao";
import type { Ficha } from "@/schemas/estimativaObra";
import { insumosProntos } from "@/test/estimativaFixtures";
import { DescrevaAObra } from "./DescrevaAObra";
import { FalhaDaIa } from "./useDescreverObra";

type Resposta = Interpretacao | FalhaDaIa;
let resposta: Resposta;
const { ler, toastOk } = vi.hoisted(() => ({ ler: vi.fn(), toastOk: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: toastOk, error: vi.fn() } }));
vi.mock("./useDescreverObra", async (original) => ({
  ...(await original<typeof import("./useDescreverObra")>()),
  useSaldoDeTokens: () => ({ data: 120_000, refetch: vi.fn() }),
  useInterpretarObra: () => ({
    mutate: (texto: string, o: { onSuccess: (r: Interpretacao) => void; onError: (e: Error) => void }) => {
      ler(texto);
      if (resposta instanceof FalhaDaIa) o.onError(resposta);
      else o.onSuccess(resposta);
    },
  }),
}));

const leitura = (parcial: Partial<Interpretacao> = {}): Interpretacao => ({
  itens: [],
  ambientes: {},
  marcenaria: null,
  relevo: null,
  fora_do_catalogo: [],
  perguntas: [],
  ...parcial,
});

/** A ficha que a tela está segurando, lida do que ela mostra. */
const fichaAtual = () => JSON.parse(screen.getByTestId("ficha").textContent ?? "{}") as Ficha;

function Tela({ inicial = fichaInicial("2027-03") }: { inicial?: Ficha }) {
  const [ficha, setFicha] = useState<Ficha>(inicial);
  const insumos = insumosProntos();
  if (insumos.estado !== "ok") throw new Error("insumos de teste não ficaram prontos");
  return (
    <>
      <DescrevaAObra
        ficha={ficha}
        atualizar={(campo, valor) => setFicha((f) => ({ ...f, [campo]: valor }))}
        aplicar={setFicha}
        insumos={insumos}
        premissas={{}}
      />
      <output data-testid="ficha" hidden>
        {JSON.stringify(ficha)}
      </output>
    </>
  );
}

const escrever = async (texto: string) => {
  const user = userEvent.setup();
  render(<Tela />);
  await user.type(screen.getByLabelText("Descreva a obra"), texto);
  return user;
};

beforeEach(() => {
  ler.mockClear();
  toastOk.mockClear();
});

describe("DescrevaAObra", () => {
  it("diz o custo e o saldo, e só libera o botão com texto", async () => {
    const user = userEvent.setup();
    render(<Tela />);
    expect(screen.getByText(/Usa cerca de 4 mil tokens\. Saldo da empresa: 120 mil\./)).toBeInTheDocument();
    const botao = screen.getByRole("button", { name: /Preencher a lista/ });
    expect(botao).toBeDisabled();
    await user.type(screen.getByLabelText("Descreva a obra"), "6 splits de 12.000 BTU");
    expect(botao).toBeEnabled();
    expect(screen.getByText(/22 de 2\.000/)).toBeInTheDocument();
  });

  it("mostra o que entendeu, com origem, e só mexe na ficha depois de Usar esta lista", async () => {
    resposta = leitura({
      itens: [
        { id: "ac12", quantidade: 6, trecho: "6 splits de 12.000 BTU" },
        { id: "automacao", quantidade: 1, trecho: "automação" },
      ],
      fora_do_catalogo: [{ texto: "sala de cinema", motivo: null }],
      relevo: { inclinado: true, arrimo_m2: 60 },
    });
    const user = await escrever("6 splits, automação e sala de cinema");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));

    expect(ler).toHaveBeenCalledWith("6 splits, automação e sala de cinema");
    expect(screen.getByText("O que entendi")).toBeInTheDocument();
    expect(screen.getByText("Split 12.000 BTU")).toBeInTheDocument();
    expect(screen.getByText(/"sala de cinema"/)).toBeInTheDocument();
    expect(screen.getByText(/60 m² de muro de arrimo/)).toBeInTheDocument();
    expect(fichaAtual().itens).toEqual({});

    await user.click(screen.getByRole("button", { name: "Usar esta lista" }));
    expect(fichaAtual().itens).toEqual({ ac12: 6, automacao: 1 });
    expect(fichaAtual().topografia).toBe("inclinado");
    expect(fichaAtual().arrimo).toBe(60);
    expect(fichaAtual().descricao).toBe("6 splits, automação e sala de cinema");
    expect(toastOk).toHaveBeenCalledWith("2 itens entraram na ficha", expect.anything());
    expect(screen.queryByText("O que entendi")).not.toBeInTheDocument();
  });

  it("quantidade ajustada e item removido valem na hora de usar", async () => {
    resposta = leitura({
      itens: [
        { id: "ac12", quantidade: 6, trecho: "" },
        { id: "ac18", quantidade: 2, trecho: "" },
      ],
    });
    const user = await escrever("ar condicionado");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));
    await user.click(screen.getByRole("button", { name: "Mais split 12.000 btu" }));
    await user.click(screen.getByRole("button", { name: "Remover Split 18.000 BTU" }));
    await user.click(screen.getByRole("button", { name: "Usar esta lista" }));
    expect(fichaAtual().itens).toEqual({ ac12: 7 });
  });

  it("pergunta com item vira campo, e a resposta entra na lista", async () => {
    resposta = leitura({ perguntas: [{ id: "fv", pergunta: "Quantos kWp tem o painel solar?" }] });
    const user = await escrever("painel solar");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));
    expect(screen.getByText("Faltou saber")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Quantos kWp tem o painel solar?"), "8");
    await user.click(screen.getByRole("button", { name: "Usar esta lista" }));
    expect(fichaAtual().itens).toEqual({ fv: 8 });
  });

  it("piscina em obra comercial avisa e não entra na ficha", async () => {
    resposta = leitura({
      itens: [
        { id: "piscina", quantidade: 20, trecho: "" },
        { id: "ac12", quantidade: 2, trecho: "" },
      ],
    });
    const user = userEvent.setup();
    render(<Tela inicial={{ ...fichaInicial("2027-03"), tipo: "comercial", subtipo: "salas" }} />);
    await user.type(screen.getByLabelText("Descreva a obra"), "piscina e ar");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));
    expect(screen.getByText(/só valem para obra residencial/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usar esta lista" }));
    expect(fichaAtual().piscina).toBe(0);
    expect(fichaAtual().itens).toEqual({ ac12: 2 });
  });

  it("nada reconhecido oferece exemplos que preenchem o texto", async () => {
    resposta = leitura();
    const user = await escrever("algo bonito");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));
    expect(screen.getByText("Não reconheci nenhum item da lista")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "6 splits de 12.000 BTU e aquecedor solar" }));
    expect(screen.getByLabelText("Descreva a obra")).toHaveValue("6 splits de 12.000 BTU e aquecedor solar");
    expect(screen.queryByText("Não reconheci nenhum item da lista")).not.toBeInTheDocument();
  });

  it("bloqueio mostra a mensagem do servidor, sem botão de tentar de novo", async () => {
    resposta = new FalhaDaIa("Você atingiu seu limite de tokens de IA deste mês.", "bloqueio");
    const user = await escrever("6 splits");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Você atingiu seu limite de tokens de IA deste mês.");
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();
  });

  it.each([
    ["erro", "Não consegui falar com a IA agora."],
    ["invalida", "A resposta da IA veio num formato que não consegui usar."],
  ] as const)("falha %s mantém o texto e permite tentar de novo ou preencher à mão", async (tipo, titulo) => {
    resposta = new FalhaDaIa("x", tipo);
    const user = await escrever("6 splits");
    await user.click(screen.getByRole("button", { name: /Preencher a lista/ }));
    const alerta = screen.getByRole("alert");
    expect(within(alerta).getByText(titulo)).toBeInTheDocument();
    expect(screen.getByLabelText("Descreva a obra")).toHaveValue("6 splits");

    await user.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(ler).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Preencher à mão" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
