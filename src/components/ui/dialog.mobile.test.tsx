import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

describe("DialogContent como painel de baixo no celular (SPEC 134)", () => {
  const abrir = () =>
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Formulário</DialogDescription>
        </DialogContent>
      </Dialog>
    );

  it("ancora embaixo, sobe de baixo e tem cantos superiores arredondados abaixo de md", () => {
    abrir();
    const painel = screen.getByRole("dialog");
    expect(painel.className).toContain("max-md:bottom-0");
    expect(painel.className).toContain("max-md:top-auto");
    expect(painel.className).toContain("max-md:data-[state=open]:slide-in-from-bottom");
    expect(painel.className).toContain("max-md:rounded-t-[26px]");
    expect(painel.className).toContain("max-md:max-h-[92dvh]");
  });

  it("de md para cima continua modal central", () => {
    abrir();
    const painel = screen.getByRole("dialog");
    expect(painel.className).toContain("md:data-[state=open]:zoom-in-95");
    expect(painel.className).toContain("top-[50%]");
  });

  it("tem a alça de fechar só para o celular, além do X", () => {
    abrir();
    const fechar = screen.getAllByRole("button", { name: "Fechar" });
    expect(fechar).toHaveLength(2);
    expect(fechar.some((b) => b.className.includes("md:hidden"))).toBe(true);
  });

  it("ocupa a largura toda mesmo quando o chamador fixa uma largura (w-[96vw])", () => {
    render(
      <Dialog open>
        <DialogContent className="w-[96vw] max-w-none">
          <DialogTitle>Projeto</DialogTitle>
          <DialogDescription>Detalhe</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog").className).toContain("max-md:w-full");
  });

  it("layout próprio (p-0) não ganha o padding lateral do painel no celular", () => {
    render(
      <Dialog open>
        <DialogContent className="flex flex-col gap-0 p-0">
          <DialogTitle>Projeto</DialogTitle>
          <DialogDescription>Detalhe</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    const classes = screen.getByRole("dialog").className;
    expect(classes).not.toContain("max-md:px-4");
    expect(classes).toContain("max-md:pt-6");
  });

  it("formulário comum segue com o padding do painel", () => {
    abrir();
    expect(screen.getByRole("dialog").className).toContain("max-md:px-4");
  });
});
