import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarStack } from "./AvatarStack";
import { AvatarDiretorioContext } from "@/contexts/AvatarDiretorioContext";
import { chaveDeNome } from "@/lib/avatarDiretorio";

const diretorio = new Map([[chaveDeNome("Matheus Rezende"), "https://x/m.png"]]);

describe("AvatarStack", () => {
  it("mostra a foto da empresa quando só chega o nome", () => {
    render(
      <AvatarDiretorioContext.Provider value={diretorio}>
        <AvatarStack pessoas={["Matheus Rezende"]} />
      </AvatarDiretorioContext.Provider>
    );
    expect(screen.getByRole("img", { name: "Matheus Rezende" })).toHaveAttribute("src", "https://x/m.png");
  });

  it("a foto passada pelo chamador vale mais que a do diretório", () => {
    render(
      <AvatarDiretorioContext.Provider value={diretorio}>
        <AvatarStack pessoas={[{ nome: "Matheus Rezende", avatarUrl: "https://x/propria.png" }]} />
      </AvatarDiretorioContext.Provider>
    );
    expect(screen.getByRole("img", { name: "Matheus Rezende" })).toHaveAttribute("src", "https://x/propria.png");
  });

  it("sem foto em lugar nenhum, mostra as iniciais", () => {
    render(<AvatarStack pessoas={["Bruno Alves"]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("BA")).toBeInTheDocument();
  });
});
