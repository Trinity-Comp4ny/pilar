import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAtividade, useEmpresas } from "./hooks";
import { TIPO_EVENTO_LABEL, nomeDoAtor, type TipoEvento } from "./lib";
import { FeedAtividade, type ItemFeed } from "./components/FeedAtividade";
import { FiltroChips } from "./components/FiltroChips";

type FiltroTipo = "todos" | TipoEvento;

const ORDEM_TIPOS: TipoEvento[] = ["cadastro", "empresa", "usuarios", "cobranca", "feedback", "acesso", "sistema"];

export default function Atividade() {
  usePageTitle("Atividade · Ultra admin");
  const [empresa, setEmpresa] = useState("todas");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const empresasQ = useEmpresas();
  const query = useAtividade(empresa === "todas" ? null : empresa, 300);

  const nomes = useMemo(() => new Map((empresasQ.data ?? []).map((e) => [e.id, e.nome])), [empresasQ.data]);
  const eventos = useMemo(() => query.data ?? [], [query.data]);

  const itens = useMemo<ItemFeed[]>(() => {
    const q = busca.trim().toLowerCase();
    return eventos
      .filter((e) => tipo === "todos" || e.tipo === tipo)
      .filter((e) => {
        if (!q) return true;
        const empresaNome = e.empresaId ? (nomes.get(e.empresaId) ?? "") : "";
        return [e.frase, e.detalhe ?? "", nomeDoAtor(e.ator), empresaNome].some((t) => t.toLowerCase().includes(q));
      })
      .map((e) => ({ ...e, empresaNome: e.empresaId ? (nomes.get(e.empresaId) ?? null) : null }));
  }, [eventos, tipo, busca, nomes]);

  const opcoesTipo = useMemo(
    () => [
      { value: "todos" as FiltroTipo, label: "Tudo", count: eventos.length },
      ...ORDEM_TIPOS.map((t) => ({
        value: t,
        label: TIPO_EVENTO_LABEL[t],
        count: eventos.filter((e) => e.tipo === t).length,
      })).filter((o) => o.count > 0 || o.value === tipo),
    ],
    [eventos, tipo]
  );

  return (
    <PilarPage title="Atividade" search={{ value: busca, onChange: setBusca, placeholder: "Buscar na atividade" }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FiltroChips<FiltroTipo> ariaLabel="Filtrar por tipo" opcoes={opcoesTipo} value={tipo} onChange={setTipo} />
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="h-9 w-56" aria-label="Filtrar por empresa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {(empresasQ.data ?? []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-black/5">
        <CardContent className="p-5">
          {query.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.error ? (
            <EmptyState
              icon={Activity}
              title="Não foi possível carregar a atividade"
              description="Tente de novo em instantes."
              action={{ label: "Tentar de novo", onClick: () => void query.refetch(), variant: "outline" }}
            />
          ) : itens.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nada por aqui com esses filtros"
              description="Cadastros, mudanças de cobrança, convites e ações do portal aparecem aqui."
            />
          ) : (
            <FeedAtividade itens={itens} />
          )}
        </CardContent>
      </Card>
    </PilarPage>
  );
}
