import { useMemo } from "react";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAtividade, useMutacoesEmpresa } from "../hooks";
import { descreverMutacao } from "../lib";
import { FeedAtividade, type ItemFeed } from "./FeedAtividade";

export function EmpresaAtividadeTab({ empresaId }: { empresaId: string }) {
  const adminQ = useAtividade(empresaId, 100);
  const dadosQ = useMutacoesEmpresa(empresaId);

  const itens = useMemo<ItemFeed[]>(() => {
    const admin: ItemFeed[] = (adminQ.data ?? []).map((e) => ({ ...e }));
    const dados: ItemFeed[] = (dadosQ.data ?? []).map((m) => ({
      id: `dado-${m.id}`,
      quando: m.quando,
      ator: m.ator,
      frase: descreverMutacao(m.action, m.tabela),
      tipo: "dados",
    }));
    return [...admin, ...dados].sort((a, b) => (a.quando < b.quando ? 1 : -1));
  }, [adminQ.data, dadosQ.data]);

  if (adminQ.isLoading || dadosQ.isLoading) return <Skeleton className="h-48 w-full" />;
  if (itens.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nada registrado nesta empresa"
        description="Ações do portal e mudanças de funcionalidade ou papel nesta empresa aparecem aqui."
      />
    );
  }
  return (
    <Card className="border border-black/5">
      <CardContent className="p-5">
        <FeedAtividade itens={itens} mostrarEmpresa={false} />
      </CardContent>
    </Card>
  );
}
