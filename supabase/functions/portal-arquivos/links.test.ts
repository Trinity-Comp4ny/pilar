import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { linksDoCliente } from "./links.ts";

Deno.test("portal só recebe os links marcados para o cliente, e só http(s)", () => {
  assertEquals(
    linksDoCliente([
      { url: "https://drive.google.com/x", rotulo: "  Pranchas\n finais ", cliente: true },
      { url: "https://interno.com", rotulo: "Planilha interna" },
      { url: "https://interno2.com", cliente: false },
      { url: "javascript:alert(1)", cliente: true },
      { url: "não é url", cliente: true },
      { url: "http://site.com/a", cliente: true },
      null,
      "texto",
    ]),
    [{ url: "https://drive.google.com/x", rotulo: "Pranchas finais" }, { url: "http://site.com/a" }]
  );
  assertEquals(linksDoCliente(null), []);
  assertEquals(linksDoCliente({ url: "https://x.com", cliente: true }), []);
});
