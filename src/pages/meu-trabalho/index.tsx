import { PilarPage } from "@/components/PilarPage";
import { usePageTitle } from "@/hooks/usePageTitle";
import { TarefasWorkspace, type MolduraTarefasProps } from "./TarefasWorkspace";
import { CONTAINER_TELA_DADOS } from "@/lib/shellLayout";

function MolduraPagina({ toolbar, search, primaryAction, children }: MolduraTarefasProps) {
  return (
    // Tela de dados: padding compacto e altura da tela, para o Quadro rolar por dentro.
    <PilarPage
      title="Tarefas"
      toolbar={toolbar}
      search={search}
      primaryAction={primaryAction}
      density="compact"
      containerClassName={CONTAINER_TELA_DADOS}
    >
      {children}
    </PilarPage>
  );
}

export default function MeuTrabalho() {
  usePageTitle("Tarefas");
  return <TarefasWorkspace moldura={MolduraPagina} />;
}
