import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { CompanyData } from "@/pages/company/types";
import { EmpresaTab } from "./Empresa";

/**
 * Aba Empresa do Admin: máscaras nos campos, salvar dados (sucesso, erro e sem
 * empresa) e logo (validação de tipo e tamanho, upload, URL pública gravada).
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  upload: vi.fn(),
  bucket: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return {
    supabase: {
      from: chain.from,
      storage: {
        from: (bucket: string) => {
          h.bucket(bucket);
          return {
            upload: h.upload,
            getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.seed.test/${path}` } }),
          };
        },
      },
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:previa");
});

const EMPRESA: CompanyData = {
  nomeEmpresa: "Seed Engenharia",
  cnpj: "",
  email: "contato@seed.test",
  contato: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  status: "active",
  logoUrl: "",
};

const estado = { atual: EMPRESA };
function Harness({ companyId = "e1" as string | null }) {
  const [data, setData] = useState(EMPRESA);
  useEffect(() => {
    estado.atual = data;
  }, [data]);
  return (
    <MemoryRouter>
      <EmpresaTab
        companyId={companyId}
        companyData={data}
        setCompanyData={(fn) => setData((prev) => fn(prev))}
        usersCount={3}
        isLoading={false}
      />
    </MemoryRouter>
  );
}

const update = () => [...h.calls].reverse().find((c) => c.table === "empresas" && c.op === "update");

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve.mockReturnValue({ data: null });
  h.upload.mockResolvedValue({ error: null });
});

describe("EmpresaTab: dados", () => {
  it("aplica máscara em CNPJ, telefone e CEP e salva os dados", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11222333000181" } });
    fireEvent.change(screen.getByLabelText("Contato"), { target: { value: "11988887777" } });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310100" } });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "São Paulo" } });
    expect(estado.atual).toMatchObject({
      cnpj: "11.222.333/0001-81",
      contato: "(11) 98888-7777",
      cep: "01310-100",
      cidade: "São Paulo",
    });

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Dados salvos", expect.any(Object)));
    expect(update()!.payload).toMatchObject({ nome: "Seed Engenharia", cnpj: "11.222.333/0001-81", cep: "01310-100" });
    expect(update()!.filters).toContainEqual(["eq", "id", "e1"]);
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("CEP curto fica sem hífen e vazio fica vazio", async () => {
    render(<Harness />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "013" } });
    expect(estado.atual.cep).toBe("013");
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "abc" } });
    expect(estado.atual.cep).toBe("");
  });

  it("erro ao salvar avisa e mantém a edição aberta", async () => {
    h.resolve.mockReturnValue({ error: { message: "permission denied" } });
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar"));
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("sem empresa não grava nada", async () => {
    render(<Harness companyId={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.calls).toHaveLength(0);
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });
});

describe("EmpresaTab: logo", () => {
  async function abrirVisual() {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Personalização" }));
    await user.click(screen.getAllByRole("button", { name: "Editar" }).at(-1)!);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    return { user, input };
  }

  it("rejeita formato inválido", async () => {
    const { user, input } = await abrirVisual();
    await user.upload(input, new File(["x"], "logo.gif", { type: "image/gif" }));
    expect(h.toastError).toHaveBeenCalledWith("Formato inválido", expect.any(Object));
    expect(screen.queryByAltText("Logo (prévia)")).not.toBeInTheDocument();
  });

  it("rejeita arquivo acima de 2MB", async () => {
    const { user, input } = await abrirVisual();
    const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    await user.upload(input, grande);
    expect(h.toastError).toHaveBeenCalledWith("Arquivo muito grande", expect.any(Object));
  });

  it("envia a logo, grava a URL pública e atualiza a empresa", async () => {
    const { user, input } = await abrirVisual();
    await user.upload(input, new File(["x"], "Logo.SVG", { type: "image/svg+xml" }));
    expect(screen.getAllByAltText("Logo (prévia)").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Configuração salva", expect.any(Object)));
    expect(h.bucket).toHaveBeenCalledWith("company-logos");
    const [caminho, , opts] = h.upload.mock.calls[0];
    expect(caminho).toMatch(/^e1\/logo-\d+\.svg$/);
    expect(opts).toEqual({ upsert: true });
    expect(update()!.payload).toEqual({ logo_url: `https://cdn.seed.test/${caminho}` });
    expect(estado.atual.logoUrl).toBe(`https://cdn.seed.test/${caminho}`);
  });

  it("falha no upload não grava a URL e avisa", async () => {
    h.upload.mockResolvedValue({ error: { message: "bucket not found" } });
    const { user, input } = await abrirVisual();
    await user.upload(input, new File(["x"], "logo.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar logo"));
    expect(update()).toBeUndefined();
    expect(estado.atual.logoUrl).toBe("");
  });

  it("salvar sem arquivo só fecha a edição; cancelar descarta a prévia", async () => {
    const { user, input } = await abrirVisual();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.upload).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole("button", { name: "Editar" }).at(-1)!);
    await user.upload(input, new File(["x"], "logo.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByAltText("Logo (prévia)")).not.toBeInTheDocument();
  });

  it("clicar na prévia abre a logo ampliada", async () => {
    const { user, input } = await abrirVisual();
    await user.upload(input, new File(["x"], "logo.png", { type: "image/png" }));
    await user.click(screen.getAllByAltText("Logo (prévia)")[0]);
    expect(await screen.findByRole("dialog", { name: "Logo da empresa" })).toBeInTheDocument();
  });
});
