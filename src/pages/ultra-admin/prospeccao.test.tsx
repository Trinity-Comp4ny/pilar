import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { filtrarNovos, type ProspecLead } from "./prospeccaoApi";
import { CardEnvio } from "./ProspeccaoHoje";
import { linhasParaLeads } from "./prospeccaoImport";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: h.rpc, from: () => ({}) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Dados sintéticos: nenhum lead real entra no repositório (público).
const lead: ProspecLead = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Estúdio Exemplo",
  segmento: "arquitetura",
  segmento_teste: false,
  cidade: "Marília",
  telefone_e164: "5514999990001",
  tipo_telefone: "celular",
  email: null,
  site: null,
  contato_nome: null,
  canal: "whatsapp",
  confianca_contato: "empresa",
  nota_encaixe: 95,
  status: "fila",
  fila_em: "2026-11-20",
  ultimo_contato_em: null,
};

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CardEnvio lead={lead} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
});

describe("CardEnvio", () => {
  it("abre o wa.me com o texto da variante empresa e só registra depois do 'Enviei'", async () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: /abrir no whatsapp/i }));
    const url = abrir.mock.calls[0][0] as string;
    expect(url.startsWith("https://wa.me/5514999990001?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Falo com a Estúdio Exemplo?");
    expect(h.rpc).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Enviei" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(1));
    expect(h.rpc).toHaveBeenCalledWith(
      "prospec_registrar",
      expect.objectContaining({ p_lead: lead.id, p_resultado: "enviei", p_canal: "whatsapp" })
    );
  });

  it("com o nome preenchido a mensagem vira a variante pessoa", async () => {
    renderCard();
    await userEvent.type(screen.getByLabelText(/nome de quem atende/i), "Liane Souza");
    const texto = screen.getByLabelText("Mensagem") as HTMLTextAreaElement;
    expect(texto.value).toMatch(/^(Bom dia|Boa tarde|Boa noite), Liane! Tudo bem\?/);
    expect(texto.value).toContain("Podemos marcar uma reunião para te apresentar?");
  });

  it("'Pediu para parar' registra o resultado parar", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /abrir no whatsapp/i }));
    await userEvent.click(screen.getByRole("button", { name: /pediu para parar/i }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("prospec_registrar", expect.objectContaining({ p_resultado: "parar" }))
    );
  });
});

describe("linhasParaLeads e filtrarNovos", () => {
  const linhas = [
    { Empresa: "A", Segmento: "Arquitetura", "Telefone principal": "(14) 99999-0001" },
    { Empresa: "A duplicada", Segmento: "Arquitetura", "Telefone principal": "(14) 99999-0001" },
    { Empresa: "B", Segmento: "Engenharia", "Telefone principal": "(14) 99999-0002" },
    { Empresa: "C", Segmento: "Padaria", "Telefone principal": "(14) 99999-0003" },
    { Empresa: "D", Segmento: "Arquitetura" },
    { Empresa: "E", Segmento: "Marmorarias", "E-mail": "e@exemplo.test" },
  ];

  it("conta o que foi descartado e por quê", () => {
    const r = linhasParaLeads(linhas);
    expect(r.linhas).toBe(6);
    expect(r.leads).toHaveLength(4);
    expect(r.descartes).toEqual({ sem_nome: 0, segmento_desconhecido: 1, sem_contato: 1 });
  });

  it("pula duplicados do arquivo, leads que já existem e números bloqueados", () => {
    const { leads } = linhasParaLeads(linhas);
    const r = filtrarNovos(leads, new Set(["t:5514999990002"]), new Set(["e:e@exemplo.test"]));
    expect(r.novos.map((l) => l.nome)).toEqual(["A"]);
    expect(r.jaExistiam).toBe(2); // duplicada no arquivo + B já no banco
    expect(r.bloqueados).toBe(1);
  });
});
