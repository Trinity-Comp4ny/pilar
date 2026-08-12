import { FolderKanban, Users, Loader2, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUsoEmpresa } from "@/components/settings/useUsoEmpresa";
import { useSettingsModal } from "@/contexts/SettingsModalContext";

// Barra de consumo de um recurso contra o teto da faixa do plano. Sem teto (plano
// não define limite ou não há assinatura), vira um contador simples.
function Medidor({
  icon: Icon,
  label,
  used,
  max,
  hint,
}: {
  icon: typeof FolderKanban;
  label: string;
  used: number;
  max: number | null;
  hint?: string;
}) {
  const hasLimit = typeof max === "number" && max > 0;
  const pct = hasLimit ? Math.min(100, Math.round((used / max!) * 100)) : 0;
  const near = hasLimit && used / max! >= 0.8;
  const full = hasLimit && used >= max!;

  return (
    <Card className="border border-black/5">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-black/70">
            <Icon size={16} className="text-black/40" /> {label}
          </span>
          <span className="text-sm tabular-nums text-black/70">
            <span className="text-lg font-semibold text-ink">{used}</span>
            {hasLimit ? (
              <span className="text-black/40"> / {max}</span>
            ) : (
              <span className="text-black/40"> · ilimitado</span>
            )}
          </span>
        </div>
        {hasLimit && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className={
                "h-full rounded-full transition-all " + (full ? "bg-red-500" : near ? "bg-amber-500" : "bg-brand")
              }
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {hint && <p className="text-xs text-black/45">{hint}</p>}
        {near && !full && <p className="text-xs font-medium text-amber-600">Você está perto do limite da sua faixa.</p>}
        {full && <p className="text-xs font-medium text-red-600">Faixa cheia. Suba de plano para abrir mais.</p>}
      </CardContent>
    </Card>
  );
}

// Aba Uso: medidor do eixo de cobrança (faixa de projetos ativos, PRICING v2).
// Usuários são ilimitados no modelo, então aparecem só como contagem informativa.
export function UsoPanel() {
  const { uso, isLoading, error } = useUsoEmpresa();
  const { openSettings } = useSettingsModal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-black/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        Não foi possível carregar o uso. Tente recarregar.
      </div>
    );
  }

  const nearProjetos =
    typeof uso.maxProjetos === "number" && uso.maxProjetos > 0 && uso.projetosAtivos / uso.maxProjetos >= 0.8;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-ink">Uso da empresa</h3>
        <p className="text-sm text-black/55">
          {uso.planoNome ? `Você está no plano ${uso.planoNome}.` : "Sem assinatura ativa no momento."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Medidor
          icon={FolderKanban}
          label="Projetos ativos"
          used={uso.projetosAtivos}
          max={uso.maxProjetos}
          hint="Conta os projetos não arquivados. É o que define a faixa da sua assinatura."
        />
        <Medidor
          icon={Users}
          label="Usuários"
          used={uso.usuarios}
          max={uso.maxUsuarios}
          hint="Usuários são ilimitados no Pilar; convide a firma inteira sem custo por cabeça."
        />
      </div>

      {(nearProjetos || !uso.planoNome) && (
        <Card className="border border-black/5 bg-black/[0.02]">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium text-ink">
                {uso.planoNome ? "Precisa de mais projetos ativos?" : "Escolha um plano"}
              </p>
              <p className="text-sm text-black/55">
                {uso.planoNome
                  ? "Suba de faixa e abra mais projetos sem trocar de ferramenta."
                  : "Assine para liberar o uso completo do Pilar."}
              </p>
            </div>
            <Button variant="brand" className="rounded-full flex-shrink-0" onClick={() => openSettings("pagamento")}>
              Ver assinatura <ArrowUpRight size={16} className="ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
