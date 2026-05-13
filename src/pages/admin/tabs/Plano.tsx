import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users, Briefcase, Database } from "lucide-react";
import { FalarComercialDialog } from "@/components/admin/FalarComercialDialog";

type Usage = {
  usuarios: number;
  projetos: number;
  clientes: number;
};

export function PlanoTab({ empresaId }: { empresaId: string | null }) {
  const [usage, setUsage] = useState<Usage>({ usuarios: 0, projetos: 0, clientes: 0 });
  const [comercialOpen, setComercialOpen] = useState(false);

  useEffect(() => {
    if (!empresaId) return;

    const load = async () => {
      const [{ count: usuarios }, { count: projetos }, { count: clientes }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId),
        supabase.from("projetos").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId),
        supabase.from("clientes").select("*", { count: "exact", head: true }).eq("empresa_id", empresaId),
      ]);

      setUsage({
        usuarios: usuarios ?? 0,
        projetos: projetos ?? 0,
        clientes: clientes ?? 0,
      });
    };

    load();
  }, [empresaId]);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-3">
                Plano Atual
                <Badge className="bg-brand/10 text-brand hover:bg-brand/10 border-transparent">Beta</Badge>
              </CardTitle>
              <CardDescription>Acesso completo ao Pilar durante o período de beta</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setComercialOpen(true)}>
              Falar com comercial
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={Users} label="Usuários ativos" value={usage.usuarios} />
            <Stat icon={Briefcase} label="Projetos" value={usage.projetos} />
            <Stat icon={Database} label="Clientes" value={usage.clientes} />
            <Stat icon={CheckCircle2} label="Status" value="Ativo" variant="ok" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Recursos incluídos</CardTitle>
          <CardDescription>Tudo o que está disponível na sua conta hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {[
              "Projetos ilimitados",
              "Leads e propostas ilimitados",
              "Financeiro completo",
              "Portal do cliente",
              "Mapa de projetos",
              "Convite de usuários ilimitados",
              "Relatórios",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-black/70">
                <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <FalarComercialDialog open={comercialOpen} onOpenChange={setComercialOpen} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  variant?: "ok";
}) {
  return (
    <div className="rounded-lg border border-black/5 bg-white p-4">
      <div className="flex items-center gap-2 text-black/50 text-xs">
        <Icon size={14} />
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-medium tracking-tight ${variant === "ok" ? "text-emerald-600" : "text-black"}`}
      >
        {value}
      </div>
    </div>
  );
}
