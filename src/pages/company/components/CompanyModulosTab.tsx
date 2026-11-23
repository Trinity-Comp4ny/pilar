import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MODULES, MODULE_ORDER, type ModuleId } from "@/lib/modules";
import { getSafeErrorMessage } from "@/lib/safeError";
import { reportInvokeError } from "@/lib/monitoring";
import { useModulosOcultos, useSetModulosOcultos, type AlvoModulos } from "../hooks/useModulosOcultos";

const ADMIN_ROLES = ["admin", "ultra_admin"];

function alternar(ocultos: ModuleId[], id: ModuleId, visivel: boolean): ModuleId[] {
  return visivel ? ocultos.filter((m) => m !== id) : [...ocultos, id];
}

export function CompanyModulosTab({ empresaId }: { empresaId: string | null | undefined }) {
  const { data, isLoading, error } = useModulosOcultos(empresaId);
  const salvar = useSetModulosOcultos(empresaId);

  const gravar = (alvo: AlvoModulos, modulos: ModuleId[]) => {
    salvar.mutate(
      { alvo, modulos },
      {
        onSuccess: () => toast.success("Módulos atualizados"),
        onError: (err) => {
          reportInvokeError(err, "set_modulos_ocultos");
          toast.error(getSafeErrorMessage(err));
        },
      }
    );
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error || !data) return <p className="text-sm text-muted-foreground">Não foi possível carregar os módulos.</p>;

  const pessoas = data.pessoas.filter((p) => !ADMIN_ROLES.includes(p.role));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Ocultar um módulo o tira do menu e das telas, sem apagar nenhum dado. Reative a qualquer momento. Ocultar não
        restringe o acesso aos dados: serve para deixar o sistema limpo.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escritório todo</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {MODULE_ORDER.map((id) => {
            const visivel = !data.empresa.includes(id);
            return (
              <div key={id} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{MODULES[id].label}</span>
                <Switch
                  checked={visivel}
                  disabled={salvar.isPending}
                  aria-label={`${MODULES[id].label} visível para o escritório`}
                  onCheckedChange={(v) => gravar({ alvo: "empresa" }, alternar(data.empresa, id, v))}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por pessoa</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {pessoas.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">Nenhum usuário além dos administradores.</p>
          )}
          {pessoas.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
              </div>
              <div className="flex flex-wrap gap-4">
                {MODULE_ORDER.map((id) => {
                  const ocultoNaEmpresa = data.empresa.includes(id);
                  const visivel = !ocultoNaEmpresa && !p.ocultos.includes(id);
                  return (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={visivel}
                        disabled={salvar.isPending || ocultoNaEmpresa}
                        aria-label={`${MODULES[id].label} para ${p.nome}`}
                        onCheckedChange={(v) =>
                          gravar({ alvo: "usuario", usuarioId: p.id }, alternar(p.ocultos, id, v))
                        }
                      />
                      {MODULES[id].label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
