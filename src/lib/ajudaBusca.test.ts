import { describe, expect, it } from "vitest";
import { artigoPorSlug, artigosDaRota, buscarArtigos } from "./ajudaBusca";
import type { ArtigoAjuda } from "@/content/ajuda/indice";

const artigo = (slug: string, titulo: string, rotas: string[], palavras: string[] = []): ArtigoAjuda => ({
  slug,
  titulo,
  resumo: "",
  grupo: "comercial",
  rotas,
  palavras,
});

const BASE = [
  artigo("lead", "Criar um lead", ["/gestao/leads"]),
  artigo("cliente", "Cadastrar um cliente", ["/gestao/clientes"]),
  artigo("portal", "Portal do cliente", ["/gestao/clientes"], ["acesso"]),
  artigo("proposta", "Criar e enviar uma proposta", ["/gestao/propostas"], ["orçamento"]),
];

describe("central de ajuda: busca (SPEC 154)", () => {
  it("rota cobre as telas abaixo dela, sem casar prefixo de outra palavra", () => {
    expect(artigosDaRota("/gestao/leads", BASE).map((a) => a.slug)).toEqual(["lead"]);
    expect(artigosDaRota("/gestao/clientes/abc/", BASE).map((a) => a.slug)).toEqual(["cliente", "portal"]);
    expect(artigosDaRota("/gestao/leadsx", BASE)).toEqual([]);
    expect(artigosDaRota("/inicio", BASE)).toEqual([]);
  });

  it("busca sem acento, título pesa mais e todas as palavras precisam casar", () => {
    expect(buscarArtigos("orcamento", BASE).map((a) => a.slug)).toEqual(["proposta"]);
    expect(buscarArtigos("cliente", BASE).map((a) => a.slug)).toEqual(["cliente", "portal"]);
    expect(buscarArtigos("portal acesso", BASE).map((a) => a.slug)).toEqual(["portal"]);
    expect(buscarArtigos("portal fatura", BASE)).toEqual([]);
    expect(buscarArtigos("a", BASE)).toEqual([]);
  });

  it("entende pergunta em linguagem natural nos artigos reais", () => {
    expect(buscarArtigos("como eu crio um lead?")[0]?.slug).toBe("criar-lead");
    expect(buscarArtigos("como faço para enviar a proposta pro cliente")[0]?.slug).toBe("criar-e-enviar-proposta");
    expect(buscarArtigos("onde convido alguém da equipe")[0]?.slug).toBe("convidar-equipe");
    expect(buscarArtigos("emitir nota fiscal eletrônica")).toEqual([]);
  });

  it("acha o artigo real pelo slug, e slug desconhecido vira null", () => {
    expect(artigoPorSlug("criar-lead")?.titulo).toBe("Criar um lead");
    expect(artigoPorSlug("nao-existe")).toBeNull();
    expect(artigoPorSlug(undefined)).toBeNull();
  });
});
