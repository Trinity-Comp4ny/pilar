import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ManifestDoApp } from "./ManifestDoApp";

beforeEach(() => {
  document.head.innerHTML =
    '<link rel="manifest" href="/manifest.webmanifest" /><meta name="apple-mobile-web-app-title" content="Pilar" />';
});
afterEach(() => {
  document.head.innerHTML = "";
});

const manifest = () => document.querySelector('link[rel="manifest"]')?.getAttribute("href");
const titulo = () => document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content;

describe("ManifestDoApp", () => {
  it("no portal do cliente, instala o app que abre no portal", () => {
    render(
      <MemoryRouter initialEntries={["/cliente/dashboard"]}>
        <ManifestDoApp />
      </MemoryRouter>
    );
    expect(manifest()).toBe("/manifest-portal.webmanifest");
    expect(titulo()).toBe("Pilar Portal");
  });

  it("no escritório, mantém o manifest do Pilar", () => {
    render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <ManifestDoApp />
      </MemoryRouter>
    );
    expect(manifest()).toBe("/manifest.webmanifest");
    expect(titulo()).toBe("Pilar");
  });
});
