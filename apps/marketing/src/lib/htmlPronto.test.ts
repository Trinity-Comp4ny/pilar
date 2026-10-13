import { describe, expect, it } from "vitest";
import { conteudoProntoDe, guardarConteudoPronto } from "./htmlPronto";

const montarRoot = (htmlDoMain: string) => {
  const root = document.createElement("div");
  root.innerHTML = `<header>Topo</header><main>${htmlDoMain}</main>`;
  return root;
};

describe("htmlPronto", () => {
  it("shell vazio (spa.html, dev) não guarda nada", () => {
    expect(guardarConteudoPronto(document.createElement("div"), "/faq")).toBe(false);
    expect(guardarConteudoPronto(montarRoot(""), "/faq")).toBe(false);
    expect(conteudoProntoDe("/faq")).toBeNull();
  });

  it("devolve os nós do main só para a rota que veio pronta", () => {
    const root = montarRoot("<h1>Planos</h1><p>Bronze</p>");
    expect(guardarConteudoPronto(root, "/planos")).toBe(true);

    // O React apaga o #root no primeiro commit; os nós continuam guardados.
    root.replaceChildren();
    const nos = conteudoProntoDe("/planos");
    expect(nos?.map((n) => n.textContent)).toEqual(["Planos", "Bronze"]);
    expect(conteudoProntoDe("/faq")).toBeNull();
  });
});
