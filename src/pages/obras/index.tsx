import { useMemo, useState } from "react";
import { GitBranch, HardHat, MapPin, Plus, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PilarPage } from "@/components/PilarPage";
import { KPICard } from "@/components/KPICard";
import { KpiResumo } from "@/components/KpiResumo";
import { CollapsibleKpiSection } from "@/components/CollapsibleKpiSection";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar, FilterClear, FilterSelect } from "@/components/filters/FilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { useResumoCustoObras } from "@/pages/obras/hooks/useResumoCustoObras";
import { useObras, useUpdateObra, type ObraResumo } from "@/pages/obras/hooks/useObras";
import { EscolherInicioObraDialog } from "./components/EscolherInicioObraDialog";
import { ObraFormDialog } from "./components/ObraFormDialog";
import { FilaCotacoesPendentes } from "./components/FilaCotacoesPendentes";
import { ObrasQuadro } from "./components/ObrasQuadro";
import { FluxosObraDialog } from "./components/FluxosObraDialog";
import { Button } from "@/components/ui/button";

export default function ObrasPage() {
  usePageTitle("Obras");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const canCreate = can("obras", "create");
  // Com a estimativa ligada na empresa, "Nova obra" pergunta como começar (SPEC 136, BEZ-24).
  const podeEstimar = can("estimativa_obra", "create");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [escolhaOpen, setEscolhaOpen] = useState(false);
  const [fluxosOpen, setFluxosOpen] = useState(false);
  const iniciarObra = () => (podeEstimar ? setEscolhaOpen(true) : setDialogOpen(true));
  const { data: obras = [], isLoading, isError } = useObras();
  const { data: custos } = useResumoCustoObras();
  const atualizar = useUpdateObra();
  const mudarStatus = (obra: ObraResumo, status: string) =>
    atualizar.mutate(
      { id: obra.id, status },
      { onError: () => toast.error("Não deu para mudar o status da obra.", { description: "Tente de novo." }) }
    );

  const [responsavel, setResponsavel] = useState("todos");
  const responsaveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of obras) if (o.responsavel) m.set(o.responsavel.id, o.responsavel.nome);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([value, label]) => ({ value, label }));
  }, [obras]);

  const filtradas = useMemo(() => {
    const t = search.trim().toLowerCase();
    return obras.filter((o) => {
      if (responsavel !== "todos" && o.responsavel?.id !== responsavel) return false;
      if (!t) return true;
      return o.nome.toLowerCase().includes(t) || (o.projeto?.nome ?? "").toLowerCase().includes(t);
    });
  }, [obras, search, responsavel]);

  const quadro = !isLoading && !isError && filtradas.length > 0;
  const ativas = obras.filter((o) => o.status === "em_andamento").length;
  const paralisadas = obras.filter((o) => o.status === "paralisada").length;

  return (
    <PilarPage
      title="Obras"
      search={{ value: search, onChange: setSearch, placeholder: "Buscar obra ou projeto" }}
      primaryAction={{
        label: "Nova obra",
        onClick: iniciarObra,
        icon: Plus,
        feature: "obras",
        dataTour: "onb-nova-obra",
      }}
      actions={
        <>
          {can("mapa", "view") && (
            <Button
              variant="outline"
              className="h-9 rounded-full text-sm"
              onClick={() => navigate("/projetos/mapa?ver=obras")}
            >
              <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
              Mapa
            </Button>
          )}
          {canCreate && (
            <Button variant="outline" className="h-9 rounded-full text-sm" onClick={() => setFluxosOpen(true)}>
              <GitBranch className="mr-2 h-4 w-4" aria-hidden="true" />
              Fluxos
            </Button>
          )}
        </>
      }
      toolbar={
        <FilterBar>
          <FilterSelect
            label="Responsável"
            icon={User}
            value={responsavel}
            emptyValue="todos"
            onChange={setResponsavel}
            options={[{ value: "todos", label: "Todos" }, ...responsaveis]}
          />
          <FilterClear count={responsavel !== "todos" ? 1 : 0} onClick={() => setResponsavel("todos")} />
        </FilterBar>
      }
      density="compact"
      className={quadro ? "md:overflow-y-hidden" : undefined}
      containerClassName={cn("flex flex-col", quadro && "md:h-full md:min-h-0")}
    >
      <CollapsibleKpiSection
        storageKey="obras"
        resumo={
          isLoading ? undefined : (
            <KpiResumo
              itens={[
                { texto: `${obras.length} obras` },
                { texto: `${ativas} em andamento` },
                { texto: `${paralisadas} paralisadas`, alerta: paralisadas > 0 },
              ]}
            />
          )
        }
      >
        <div className="grid grid-cols-3 gap-2">
          <KPICard density="compact" label="Obras" value={String(obras.length)} icon={HardHat} loading={isLoading} />
          <KPICard density="compact" label="Em andamento" value={String(ativas)} tone="info" loading={isLoading} />
          <KPICard
            density="compact"
            label="Paralisadas"
            value={String(paralisadas)}
            tone="attention"
            loading={isLoading}
          />
        </div>
      </CollapsibleKpiSection>

      <FilaCotacoesPendentes />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={HardHat}
          title="Não foi possível carregar as obras"
          description="Recarregue a página. Se persistir, avise o suporte."
        />
      ) : obras.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Nenhuma obra ainda"
          description="Crie a primeira obra a partir de um projeto para acompanhar a execução em campo."
          action={canCreate ? { label: "Nova obra", onClick: iniciarObra } : undefined}
        />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={HardHat} title="Nada encontrado" description="Nenhuma obra bate com a busca." />
      ) : (
        <div className="min-h-0 flex-1">
          <ObrasQuadro
            obras={filtradas}
            podeEditar={can("obras", "edit")}
            onMudarStatus={mudarStatus}
            custos={custos}
          />
        </div>
      )}

      <EscolherInicioObraDialog
        open={escolhaOpen}
        onOpenChange={setEscolhaOpen}
        onEmBranco={() => setDialogOpen(true)}
      />
      <ObraFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <FluxosObraDialog open={fluxosOpen} onOpenChange={setFluxosOpen} />
    </PilarPage>
  );
}
