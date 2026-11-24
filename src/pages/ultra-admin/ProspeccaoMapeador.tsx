import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { KPICard } from "@/components/KPICard";
import { PageLoader } from "@/components/motion/PageLoader";
import { useMapeador, useSalvarMapeador } from "./prospeccaoApi";

/** Aba Mapeador (SPEC 172 fase 1): liga o cron semanal do Places, define o teto e mostra a cobertura. */
export function ProspeccaoMapeador() {
  const { data, isPending } = useMapeador();
  const salvar = useSalvarMapeador();
  const [teto, setTeto] = useState<string | null>(null);

  if (isPending || !data) return <PageLoader />;

  const tetoAtual = teto ?? String(data.tetoSemanal);
  const gravar = (ativo: boolean, valor: number) =>
    salvar.mutate(
      { ativo, teto: valor },
      {
        onSuccess: () => toast.success("Mapeador atualizado"),
        onError: (e: Error) => toast.error(e.message),
      }
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Mapeador" value={data.ativo ? "Ligado" : "Desligado"} />
        <KPICard label="Buscas na semana" value={`${data.buscasSemana} de ${data.tetoSemanal}`} />
      </div>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Rodar toda semana (domingo, 22h)</p>
            <p className="text-sm text-ink-muted">
              Só liga depois de gravar a chave do Places no Supabase. Para sozinho no teto da semana.
            </p>
          </div>
          <Switch
            checked={data.ativo}
            disabled={salvar.isPending}
            onCheckedChange={(v) => gravar(v, data.tetoSemanal)}
            aria-label="Ligar mapeador"
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-sm">
            Teto semanal de buscas
            <Input type="number" min={0} max={5000} value={tetoAtual} onChange={(e) => setTeto(e.target.value)} />
          </label>
          <Button
            variant="outline"
            loading={salvar.isPending}
            onClick={() => gravar(data.ativo, Math.max(0, Math.min(5000, Number(tetoAtual) || 0)))}
          >
            Salvar teto
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Cobertura por região</h2>
        {data.cobertura.map((r) => (
          <div key={r.regiao} className="flex items-center justify-between rounded-md border border-line p-3 text-sm">
            <span>{r.regiao}</span>
            <span className="text-ink-muted">
              {r.feitas} de {r.total} células · {r.leads} leads novos
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
