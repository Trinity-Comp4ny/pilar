import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ mutation: vi.fn(), toque: vi.fn() }));
vi.mock("./haptico", () => ({ hapticoDeMutation: h.mutation, iniciarRastroDeToque: h.toque }));

import { iniciarMobile } from "./mobileBoot";

describe("iniciarMobile", () => {
  it("liga o rastro de toque e repassa o evento de mutation ao háptico", () => {
    iniciarMobile();
    expect(h.toque).toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent("pilar:mutation", { detail: { tipo: "sucesso", meta: { a: 1 } } }));
    expect(h.mutation).toHaveBeenCalledWith("sucesso", { a: 1 });
  });
});
