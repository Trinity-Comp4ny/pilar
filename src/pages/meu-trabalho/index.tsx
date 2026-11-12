import { PilarPage } from "@/components/PilarPage";
import { usePageTitle } from "@/hooks/usePageTitle";
import { TarefasWorkspace, type MolduraTarefasProps } from "./TarefasWorkspace";

function MolduraPagina({ toolbar, search, primaryAction, children }: MolduraTarefasProps) {
  return (
    // Tela de dados: padding compacto e altura da tela, para o Quadro rolar por dentro.
    <PilarPage
      title="Tarefas"
      toolbar={toolbar}
      search={search}
      primaryAction={primaryAction}
      density="compact"
      containerClassName="h-full flex flex-col min-h-0"
    >
      {children}
    </PilarPage>
  );
}

export default function MeuTrabalho() {
  usePageTitle("Tarefas");
  return <TarefasWorkspace moldura={MolduraPagina} />;
}
