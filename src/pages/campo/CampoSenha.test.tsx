import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fake } from "@/pages/obras/testing/supabaseFake";

// Senha do Pilar Campo: o convite define a primeira senha (token vem na URL) e a troca
// rotaciona o token da sessão. Política de senha e confirmação barram antes de chamar o banco.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import CampoConvite from "./CampoConvite";
import CampoTrocarSenha from "./CampoTrocarSenha";
import { getCampoToken, setCampoToken } from "./useCampoAuth";

const SENHA_BOA = "Obra#Segura2026";

function montar(rota: string) {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/campo/convite" element={<CampoConvite />} />
        <Route path="/campo/trocar-senha" element={<CampoTrocarSenha />} />
        <Route path="/campo" element={<p>Home do campo</p>} />
        <Route path="/campo/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function preencher(senha: string, confirma: string) {
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: senha } });
  fireEvent.change(screen.getByLabelText("Repita a senha"), { target: { value: confirma } });
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  sessionStorage.clear();
});

describe("CampoConvite", () => {
  const enviar = () => fireEvent.click(screen.getByRole("button", { name: /Definir senha e entrar/ }));

  it("link sem token mostra 'Link inválido' e leva ao login", () => {
    montar("/campo/convite");
    expect(screen.getByText("Link inválido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir para o login" }));
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
  });

  it("senha fora da política não chama o banco", async () => {
    montar("/campo/convite?token=conv-1");
    preencher("curta", "curta");
    enviar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Senha não atende aos requisitos", expect.anything()));
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("confirmação diferente não chama o banco", async () => {
    montar("/campo/convite?token=conv-1");
    preencher(SENHA_BOA, SENHA_BOA + "x");
    enviar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("As senhas não conferem"));
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("mostrar senha alterna o tipo dos dois campos", () => {
    montar("/campo/convite?token=conv-1");
    const nova = screen.getByLabelText("Nova senha");
    expect(nova).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(nova).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Repita a senha")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(nova).toHaveAttribute("type", "password");
  });

  it("sucesso guarda o token novo e entra no app", async () => {
    fake.rpc.mockResolvedValue({ data: { ok: true, token: "sess-9" }, error: null });
    montar("/campo/convite?token=conv-1");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith("campo_convite_definir_senha", { p_token: "conv-1", p_senha: SENHA_BOA });
    expect(getCampoToken()).toBe("sess-9");
    expect(toast.success).toHaveBeenCalledWith("Senha definida");
  });

  it("convite expirado mostra o erro do servidor e não guarda sessão", async () => {
    fake.rpc.mockResolvedValue({ data: { ok: false, erro: "Convite expirado" }, error: null });
    montar("/campo/convite?token=conv-1");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível definir a senha", {
        description: "Convite expirado",
      })
    );
    expect(getCampoToken()).toBeNull();
    expect(screen.queryByText("Home do campo")).not.toBeInTheDocument();
  });

  it("resposta ok sem token cai na mensagem padrão de convite expirado", async () => {
    fake.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    montar("/campo/convite?token=conv-1");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível definir a senha", {
        description: expect.stringContaining("O convite pode ter expirado"),
      })
    );
    expect(getCampoToken()).toBeNull();
  });

  it("falha de rede avisa e reabilita o botão", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    montar("/campo/convite?token=conv-1");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha na conexão", expect.anything()));
    expect(screen.getByRole("button", { name: /Definir senha e entrar/ })).toBeEnabled();
  });
});

describe("CampoTrocarSenha", () => {
  const enviar = () => fireEvent.click(screen.getByRole("button", { name: /Salvar e entrar/ }));

  it("senha fraca não chama o banco", async () => {
    setCampoToken("tok-1");
    montar("/campo/trocar-senha");
    preencher("semnumero", "semnumero");
    enviar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Senha não atende aos requisitos", expect.anything()));
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("confirmação diferente não chama o banco", async () => {
    setCampoToken("tok-1");
    montar("/campo/trocar-senha");
    preencher(SENHA_BOA, "Outra#Senha2026");
    enviar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("As senhas não conferem"));
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("sem sessão volta para o login sem chamar o banco", async () => {
    montar("/campo/trocar-senha");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("sucesso rotaciona o token e volta para a home", async () => {
    setCampoToken("tok-velho");
    fake.rpc.mockResolvedValue({ data: { ok: true, token: "tok-novo" }, error: null });
    montar("/campo/trocar-senha");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith("campo_trocar_senha", { p_token: "tok-velho", p_nova_senha: SENHA_BOA });
    expect(getCampoToken()).toBe("tok-novo");
  });

  it("recusa do servidor mantém o token antigo e mostra o motivo", async () => {
    setCampoToken("tok-velho");
    fake.rpc.mockResolvedValue({ data: { ok: false, erro: "Senha igual à anterior" }, error: null });
    montar("/campo/trocar-senha");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "Senha igual à anterior" })
    );
    expect(getCampoToken()).toBe("tok-velho");
  });

  it("resposta vazia usa a mensagem padrão", async () => {
    setCampoToken("tok-velho");
    fake.rpc.mockResolvedValue({ data: null, error: null });
    montar("/campo/trocar-senha");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "Tente novamente" })
    );
  });

  it("erro de rede avisa a falha de conexão", async () => {
    setCampoToken("tok-velho");
    fake.rpc.mockRejectedValue(new Error("offline"));
    montar("/campo/trocar-senha");
    preencher(SENHA_BOA, SENHA_BOA);
    enviar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha na conexão", expect.anything()));
    expect(getCampoToken()).toBe("tok-velho");
  });
});
