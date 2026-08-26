import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HardHat, MapPin, Plus, User, Globe } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { KPICard } from "@/components/KPICard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { useObras, type ObraResumo } from "@/hooks/useObras";
import { ObraFormDialog } from "./components/ObraFormDialog";
import { FilaCotacoesPendentes } from "./components/FilaCotacoesPendentes";

function ObraCard({ obra }: { obra: ObraResumo }) {
  return (
    <Link to={`/obras/${obra.id}`} className="group">
      <Card className="rounded-2xl border border-black/5 bg-white transition-colors hover:border-brand/40">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink group-hover:text-brand">{obra.nome}</p>
              <p className="truncate text-xs text-muted-foreground">{obra.projeto?.nome ?? "Sem projeto"}</p>
            </div>
            <StatusBadge domain="obra" status={obra.status} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Avanço</span>
              <span className="tabular-nums">{obra.avanco}%</span>
            </div>
            <Progress value={obra.avanco} className="h-1.5" />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {obra.responsavel?.nome ?? "Sem responsável"}
            </span>
            {obra.cidade && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {obra.cidade}
              </span>
            )}
            {obra.visivel_portal && obra.cliente_id && (
              <span
                className="inline-flex items-center gap-1.5 text-positive-strong"
                title="Cliente acompanha esta obra no portal"
              >
                <Globe className="h-3.5 w-3.5" />
                No portal
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ObrasPage() {
  usePageTitle("Obras");
  const { can } = usePermissions();
  const canCreate = can("obras", "create");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: obras = [], isLoading, isError } = useObras();

  const filtradas = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return obras;
    return obras.filter((o) => o.nome.toLowerCase().includes(t) || (o.projeto?.nome ?? "").toLowerCase().includes(t));
  }, [obras, search]);

  const ativas = obras.filter((o) => o.status === "em_andamento").length;
  const paralisadas = obras.filter((o) => o.status === "paralisada").length;

  return (
    <PilarPage
      title="Obras"
      search={{ value: search, onChange: setSearch, placeholder: "Buscar obra ou projeto" }}
      primaryAction={{
        label: "Nova obra",
        onClick: () => setDialogOpen(true),
        icon: Plus,
        feature: "obras",
        dataTour: "onb-nova-obra",
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label="Obras" value={String(obras.length)} icon={HardHat} loading={isLoading} />
        <KPICard label="Em andamento" value={String(ativas)} tone="info" loading={isLoading} />
        <KPICard label="Paralisadas" value={String(paralisadas)} tone="attention" loading={isLoading} />
      </div>

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
          action={canCreate ? { label: "Nova obra", onClick: () => setDialogOpen(true) } : undefined}
        />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={HardHat} title="Nada encontrado" description="Nenhuma obra bate com a busca." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((o) => (
            <ObraCard key={o.id} obra={o} />
          ))}
        </div>
      )}

      <ObraFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </PilarPage>
  );
}
