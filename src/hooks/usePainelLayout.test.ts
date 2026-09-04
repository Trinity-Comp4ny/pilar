import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { ItemLayout } from "./usePainelLayout";

/**
 * Layout do painel, por usuário (SPEC 092, ADR 0038).
 *
 * O que importa aqui é a leitura tolerante: `painel_layout` é estado que
 * envelhece no banco, escrito por uma versão anterior da tela. Um layout
 * malformado, ou de um release que não existe mais, tem que cair no padrão em
 * vez de derrubar o `/inicio`.
 */

const rpc = vi.fn();
const refreshProfile = vi.fn();
const toastError = vi.fn();
let perfil: unknown = null;

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: perfil, refreshProfile }),
}));
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m) } }));

import { usePainelLayout } from "./usePainelLayout";

const PADRAO: ItemLayout[] = [
  { w: "projetos_numeros", s: "meia", z: "topo" },
  { w: "projetos_prazos_15", s: "meia" },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const montar = () => renderHook(() => usePainelLayout(PADRAO), { wrapper });

describe("usePainelLayout", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    refreshProfile.mockReset().mockResolvedValue(undefined);
    toastError.mockReset();
    perfil = null;
  });

  describe("leitura", () => {
    it("usa o padrão quando o perfil ainda não carregou", () => {
      const { result } = montar();
      expect(result.current.layout).toEqual(PADRAO);
      expect(result.current.usandoPadrao).toBe(true);
    });

    it("usa o padrão quando o layout salvo é uma lista vazia", () => {
      // Lista vazia é o que "Restaurar padrão" grava: significa padrão, não
      // painel em branco.
      perfil = { painel_layout: [] };
      const { result } = montar();
      expect(result.current.layout).toEqual(PADRAO);
      expect(result.current.usandoPadrao).toBe(true);
    });

    it("usa o layout salvo quando ele é válido, preservando ordem e zona", () => {
      perfil = {
        painel_layout: [
          { w: "gestao_funil", s: "terco", z: "grade" },
          { w: "gestao_propostas_numeros", s: "meia", z: "topo" },
        ],
      };
      const { result } = montar();
      expect(result.current.usandoPadrao).toBe(false);
      expect(result.current.layout.map((i) => i.w)).toEqual(["gestao_funil", "gestao_propostas_numeros"]);
      expect(result.current.layout[1].z).toBe("topo");
    });

    it("aceita item sem zona, que é o layout de quem salvou antes da faixa fixa", () => {
      perfil = { painel_layout: [{ w: "gestao_funil", s: "meia" }] };
      const { result } = montar();
      expect(result.current.usandoPadrao).toBe(false);
      expect(result.current.layout[0].z).toBeUndefined();
    });

    // ── Layout malformado: cada caso cai no padrão, nunca quebra a tela ─────
    it.each([
      ["não é lista", { w: "gestao_funil", s: "meia" }],
      ["tamanho desconhecido", [{ w: "gestao_funil", s: "gigante" }]],
      ["zona desconhecida", [{ w: "gestao_funil", s: "meia", z: "rodape" }]],
      ["item sem id", [{ s: "meia" }]],
      ["id vazio", [{ w: "", s: "meia" }]],
      ["lixo de outro formato", ["gestao_funil"]],
      ["nulo", null],
      ["string", "isso não é layout"],
    ])("cai no padrão quando o layout salvo %s", (_caso, valor) => {
      perfil = { painel_layout: valor };
      const { result } = montar();
      expect(result.current.layout).toEqual(PADRAO);
      expect(result.current.usandoPadrao).toBe(true);
    });

    it("cai no padrão inteiro se UM item for inválido, em vez de renderizar meio layout", () => {
      // Zod valida o array todo: meio layout salvo seria pior que o padrão,
      // porque o usuário veria uma tela que ele não montou nem reconhece.
      perfil = {
        painel_layout: [
          { w: "gestao_funil", s: "meia" },
          { w: "gestao_motivo_perda", s: "tamanho_que_nao_existe" },
        ],
      };
      const { result } = montar();
      expect(result.current.usandoPadrao).toBe(true);
    });
  });

  describe("gravação", () => {
    it("salva pela RPC e recarrega o perfil, para a tela refletir o que foi gravado", async () => {
      const { result } = montar();
      const novo: ItemLayout[] = [{ w: "obras_numeros", s: "inteira" }];

      await result.current.salvar(novo);

      expect(rpc).toHaveBeenCalledWith("set_painel_layout", { p_layout: novo });
      await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
    });

    it("restaurar padrão grava lista vazia, que é como o padrão é representado", async () => {
      perfil = { painel_layout: [{ w: "gestao_funil", s: "meia" }] };
      const { result } = montar();

      await result.current.restaurarPadrao();

      expect(rpc).toHaveBeenCalledWith("set_painel_layout", { p_layout: [] });
    });

    it("avisa o usuário quando a gravação falha, sem derrubar a tela", async () => {
      rpc.mockResolvedValue({ error: new Error("painel_layout: no máximo 40 widgets") });
      const { result } = montar();

      await expect(result.current.salvar([{ w: "gestao_funil", s: "meia" }])).rejects.toThrow();

      await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
      expect(toastError.mock.calls[0][0]).toContain("no máximo 40 widgets");
      // O layout em tela continua o de antes: a tela não fica num estado que o
      // banco não tem.
      expect(result.current.layout).toEqual(PADRAO);
      expect(refreshProfile).not.toHaveBeenCalled();
    });

    it("expõe o estado de salvando, para o botão poder travar", async () => {
      let liberar: (v: { error: null }) => void = () => {};
      rpc.mockImplementation(() => new Promise((res) => (liberar = res)));
      const { result } = montar();

      const pendente = result.current.salvar([{ w: "gestao_funil", s: "meia" }]);
      await waitFor(() => expect(result.current.salvando).toBe(true));

      liberar({ error: null });
      await pendente;
      await waitFor(() => expect(result.current.salvando).toBe(false));
    });
  });
});
