import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { prepararAmbiente, renderNaRota } from "../../test/ambiente";
import { DEMO_URL } from "../../lib/contato";
import { APP_URL } from "../../config";
import { SplitButton } from "./SplitButton";

beforeAll(() => prepararAmbiente());

describe("SplitButton", () => {
  it("destino fora do Pilar (agenda da demo) abre em nova aba, sem opener", () => {
    renderNaRota(<SplitButton href={DEMO_URL}>Agendar demonstração</SplitButton>);
    const link = screen.getByRole("link", { name: /Agendar demonstração/ });
    expect(link).toHaveAttribute("href", DEMO_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([`${APP_URL}/login`, `${APP_URL}/inicio`, "https://www.pilarsoft.com.br/planos", "/faq"])(
    "%s continua na mesma aba",
    (href) => {
      renderNaRota(<SplitButton href={href}>Ir</SplitButton>);
      const link = screen.getByRole("link", { name: /Ir/ });
      expect(link).not.toHaveAttribute("target");
      expect(link).not.toHaveAttribute("rel");
    }
  );

  it("domínio parecido que não é do Pilar conta como externo", () => {
    renderNaRota(<SplitButton href="https://pilarsoft.com.br.exemplo.com/x">Ir</SplitButton>);
    expect(screen.getByRole("link", { name: /Ir/ })).toHaveAttribute("target", "_blank");
  });

  it("com `to`, navega pelo roteador", () => {
    renderNaRota(<SplitButton to="/planos">Planos</SplitButton>);
    const link = screen.getByRole("link", { name: /Planos/ });
    expect(link).toHaveAttribute("href", "/planos");
    expect(link).not.toHaveAttribute("target");
  });
});
