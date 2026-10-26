import { PilarPage } from "@/components/PilarPage";
import { usePageTitle } from "@/hooks/usePageTitle";
import { TarefasWorkspace, type MolduraTarefasProps } from "./TarefasWorkspace";

function MolduraPagina({ toolbar, search, primaryAction, children }: MolduraTarefasProps) {
  return (
    <PilarPage title="Tarefas" toolbar={toolbar} search={search} primaryAction={primaryAction}>
      {children}
    </PilarPage>
  );
}

export default function MeuTrabalho() {
  usePageTitle("Tarefas");
  return <TarefasWorkspace moldura={MolduraPagina} />;
}
