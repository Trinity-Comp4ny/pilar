import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Modal aberto por estado, como o app faz (sem DialogTrigger): o Radix não tem Trigger
// para devolver o foco, e ele caía no <body>.
function ModalPorEstado({ onCloseAutoFocus }: { onCloseAutoFocus?: (e: Event) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir</button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("devolução de foco ao fechar modal aberto por estado", () => {
  it("Dialog: Esc devolve o foco ao botão que abriu", async () => {
    const user = userEvent.setup();
    render(<ModalPorEstado />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await user.click(abrir);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("Dialog: respeita onCloseAutoFocus próprio que cancela a devolução", async () => {
    const user = userEvent.setup();
    render(<ModalPorEstado onCloseAutoFocus={(e) => e.preventDefault()} />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await user.click(abrir);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(abrir).not.toHaveFocus();
  });

  it("AlertDialog: Esc devolve o foco ao botão que abriu", async () => {
    const user = userEvent.setup();
    function Alerta() {
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <button onClick={() => setAberto(true)}>Excluir</button>
          <AlertDialog open={aberto} onOpenChange={setAberto}>
            <AlertDialogContent>
              <AlertDialogTitle>Confirmar</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza?</AlertDialogDescription>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    render(<Alerta />);
    const excluir = screen.getByRole("button", { name: "Excluir" });
    await user.click(excluir);
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    await Promise.resolve();
    expect(excluir).toHaveFocus();
  });
});
