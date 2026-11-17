import { useMemo, useState } from "react";
import { PilarPage } from "@/components/PilarPage";
import { FilterBar } from "@/components/filters/FilterBar";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AbaAgenda } from "./components/AbaAgenda";
import { useMinhaPessoa, usePessoasEmpresa } from "./hooks";
import { resolverPessoaIds } from "./filtroPessoas";

/** Agenda: calendário pessoal (disciplinas, tarefas com prazo e reuniões). Vive fora de Tarefas. */
export default function Agenda() {
  usePageTitle("Agenda");
  const { profile } = useAuth();
  const { isAdmin } = usePermissions();
  const { canView: temProjetos } = useFeatureAccess("projetos");
  const { data: minhaPessoa } = useMinhaPessoa();
  const { data: pessoas } = usePessoasEmpresa();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  const minhaPessoaId =
    minhaPessoa?.id ?? (profile?.id ? (pessoas ?? []).find((p) => p.profileId === profile.id)?.id : undefined) ?? null;
  const pessoaIds = useMemo(() => resolverPessoaIds({ filtroPessoas: [], minhaPessoaId }), [minhaPessoaId]);

  return (
    <PilarPage
      title="Agenda"
      toolbar={
        <FilterBar>
          {/* Navegação do calendário (anterior/próximo, Hoje, Mês/Semana) entra aqui. */}
          <div ref={setSlot} className="flex items-center" />
        </FilterBar>
      }
      density="compact"
      containerClassName="h-full flex flex-col min-h-0"
    >
      <AbaAgenda
        pessoaIds={pessoaIds}
        minhaPessoaId={minhaPessoaId}
        canEdit
        temProjetos={temProjetos}
        podeEscolherResponsavel={isAdmin}
        toolbarSlot={slot}
      />
    </PilarPage>
  );
}
