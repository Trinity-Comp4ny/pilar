import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { idDoDispositivo } from "@/lib/dispositivo";
import { formatDateTime } from "@/lib/format";

const KEY = ["meus-navegadores"] as const;

/**
 * Navegadores que já entraram na conta (SPEC 159). Ajuda a reconhecer um acesso estranho; o
 * alerta de acesso novo chega no sino e por e-mail. "Esquecer" tira da lista: se esse navegador
 * voltar, o alerta sai de novo.
 */
export function NavegadoresConta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const atual = idDoDispositivo();

  const query = useQuery({
    queryKey: [...KEY, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuario_dispositivos")
        .select("dispositivo_id, descricao, primeiro_em, ultimo_em")
        .eq("user_id", user!.id)
        .order("ultimo_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const esquecer = useMutation({
    mutationFn: async (dispositivoId: string) => {
      const { error } = await supabase
        .from("usuario_dispositivos")
        .delete()
        .eq("user_id", user!.id)
        .eq("dispositivo_id", dispositivoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Navegador esquecido");
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.error("Não foi possível esquecer o navegador"),
  });

  const lista = query.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5" />
          Navegadores que entraram na sua conta
        </CardTitle>
        <CardDescription>
          Um navegador novo gera um aviso no sino e por e-mail. Não reconhece algum? Troque a senha e use Sair dos
          outros dispositivos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lista.length === 0 && !query.isLoading ? (
          <EmptyState compact title="Nenhum navegador registrado ainda." />
        ) : (
          <ul className="divide-y divide-black/5">
            {lista.map((d) => (
              <li key={d.dispositivo_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-ink">
                    {d.descricao ?? "Navegador"}
                    {d.dispositivo_id === atual && <Badge variant="info">Este navegador</Badge>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {`Primeiro acesso ${formatDateTime(d.primeiro_em)} · último ${formatDateTime(d.ultimo_em)}`}
                  </p>
                </div>
                {d.dispositivo_id !== atual && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={esquecer.isPending && esquecer.variables === d.dispositivo_id}
                    onClick={() => esquecer.mutate(d.dispositivo_id)}
                  >
                    Esquecer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
