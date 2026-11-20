import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { PropostaLinkVersao } from "./PropostaLinkVersao";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

function montar(over: Partial<Tables<"proposta_versoes">>, podePublicar = true) {
  const versao = { id: "v-2", numero: 2, ...over } as Tables<"proposta_versoes">;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PropostaLinkVersao versao={versao} podePublicar={podePublicar} />
    </QueryClientProvider>
  );
}
it("publica apenas o ID da versão escolhida", async () => {
  rpc.mockResolvedValueOnce({ data: "token", error: null });
  montar({});
  fireEvent.click(screen.getByRole("button", { name: "Publicar link" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("publicar_link_proposta", { p_versao_id: "v-2" }));
});
it("copia o link e apresenta as aberturas e o aceite da versão", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const data = "2026-11-19T12:00:00Z";
  montar({ link_token: "token", primeira_abertura_em: data, ultima_abertura_em: data, aceita_em: data }, false);
  expect(screen.getByText(/Primeira abertura/)).toBeInTheDocument();
  expect(screen.getByText(/Versão aceita em/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/proposta-compartilhada#token")));
});
it("oculta a publicação para uma versão anterior ou sem permissão", () => {
  montar({}, false);
  expect(screen.queryByRole("button", { name: "Publicar link" })).not.toBeInTheDocument();
});

it("exige confirmação antes de revogar e envia somente o ID da versão", async () => {
  rpc.mockClear();
  rpc.mockResolvedValueOnce({ data: true, error: null });
  montar({ link_token: "token" });
  fireEvent.click(screen.getByRole("button", { name: "Revogar link" }));
  expect(rpc).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revogação" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("revogar_link_proposta", { p_versao_id: "v-2" }));
});
it("mantém o link aceito disponível para consulta", () => {
  montar({ link_token: "token", aceita_em: "2026-11-19T12:00:00Z" });
  expect(screen.queryByRole("button", { name: "Revogar link" })).not.toBeInTheDocument();
});
