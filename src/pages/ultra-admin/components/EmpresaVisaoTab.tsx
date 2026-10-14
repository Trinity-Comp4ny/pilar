import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumberCompact } from "@/lib/format";
import type { EmpresaDetalhe as Empresa } from "../api";
import { useAtividade } from "../hooks";
import { useCustosIa, useFormatCusto } from "../custos";
import { quandoRelativo } from "../lib";
import { Fato } from "./Fato";
import { EmptyState } from "@/components/EmptyState";

export function EmpresaVisaoTab({ empresa, onVerAtividade }: { empresa: Empresa; onVerAtividade: () => void }) {
  const formatCusto = useFormatCusto();
  const custosQ = useCustosIa();
  const atividadeQ = useAtividade(empresa.id, 6);
  const ia = custosQ.data?.porEmpresa.find((e) => e.empresaId === empresa.id);
  const admins = empresa.usuarios.filter((u) => !u.isPending && (u.role === "admin" || u.role === "ultra_admin"));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border border-black/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">IA no mês</CardTitle>
        </CardHeader>
        <CardContent>
          {custosQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !ia ? (
            <EmptyState compact title="Nenhuma chamada de IA neste mês." />
          ) : (
            <dl className="grid grid-cols-2 gap-4">
              <Fato label="Chamadas">{formatNumberCompact(ia.chamadas)}</Fato>
              <Fato label="Tokens">{formatNumberCompact(ia.tokensTotal)}</Fato>
              <Fato label="Custo">{formatCusto(ia.custo)}</Fato>
              <Fato label="Por chamada">{ia.chamadas > 0 ? formatCusto(ia.custo / ia.chamadas) : "-"}</Fato>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="border border-black/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quem administra</CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <EmptyState compact title="Nenhum admin ativo. Convide alguém na aba Usuários." />
          ) : (
            <ul className="space-y-2.5">
              {admins.map((u) => (
                <li key={u.id} className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {u.email} · {quandoRelativo(u.lastSignInAt) ?? "nunca entrou"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border border-black/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Últimas ações</CardTitle>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onVerAtividade}>
            Ver tudo
          </Button>
        </CardHeader>
        <CardContent>
          {atividadeQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (atividadeQ.data ?? []).length === 0 ? (
            <EmptyState compact title="Nada registrado ainda." />
          ) : (
            <ul className="space-y-2">
              {(atividadeQ.data ?? []).map((ev) => (
                <li key={ev.id} className="text-sm text-ink-soft">
                  {ev.frase}
                  <span className="text-xs text-ink-muted"> · {quandoRelativo(ev.quando)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
