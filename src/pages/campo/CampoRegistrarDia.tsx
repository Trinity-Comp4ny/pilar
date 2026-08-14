import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CLIMA_OPCOES } from "@/lib/obras";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getCampoToken } from "./useCampoAuth";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function CampoRegistrarDia() {
  usePageTitle("Pilar Campo | Registrar o dia");
  const navigate = useNavigate();
  const [data, setData] = useState(hoje());
  const [clima, setClima] = useState<string | null>(null);
  const [efetivo, setEfetivo] = useState("");
  const [atividades, setAtividades] = useState("");
  const [ocorrencias, setOcorrencias] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getCampoToken();
    if (!token) {
      navigate("/campo/login", { replace: true });
      return;
    }
    setSaving(true);
    try {
      // callUntypedRpc: os args da RPC aceitam null (clima/efetivo opcionais), mas
      // o gen:types marca os parâmetros como não-nulos. Evita o cast solto.
      const { data: res, error } = await callUntypedRpc<{ ok: boolean; erro?: string }>("campo_salvar_rdo", {
        p_token: token,
        p_data: data,
        p_clima: clima,
        p_condicao: null,
        p_efetivo: efetivo.trim() === "" ? null : Number(efetivo),
        p_atividades: atividades,
        p_ocorrencias: ocorrencias,
        p_pendencias: null,
      });
      if (error) throw error;
      if (!res?.ok) {
        toast.error("Não foi possível registrar", { description: res?.erro ?? "Tente de novo" });
        return;
      }
      toast.success("Dia registrado");
      navigate("/campo", { replace: true });
    } catch {
      toast.error("Falha na conexão", { description: "Verifique a internet e tente de novo." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campo")} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-ink">Registrar o dia</span>
      </header>

      <form onSubmit={salvar} className="mx-auto max-w-md space-y-5 px-5 py-6">
        <div className="space-y-1.5">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            max={hoje()}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label>Clima</Label>
          <div className="grid grid-cols-2 gap-2">
            {CLIMA_OPCOES.map((c) => {
              const ativo = clima === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setClima(ativo ? null : c.value)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition-colors",
                    ativo ? "border-brand bg-brand text-ink" : "border-black/10 bg-muted/40 text-ink"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="efetivo">Quantas pessoas trabalharam</Label>
          <Input
            id="efetivo"
            type="number"
            inputMode="numeric"
            min={0}
            value={efetivo}
            onChange={(e) => setEfetivo(e.target.value)}
            placeholder="Ex: 8"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="atividades">O que foi feito hoje</Label>
          <Textarea
            id="atividades"
            rows={4}
            value={atividades}
            onChange={(e) => setAtividades(e.target.value)}
            placeholder="Ex: concretagem da laje, alvenaria do 2º pavimento…"
            className="text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ocorrencias">Ocorrências (opcional)</Label>
          <Textarea
            id="ocorrencias"
            rows={2}
            value={ocorrencias}
            onChange={(e) => setOcorrencias(e.target.value)}
            placeholder="Chuva, falta de material, acidente…"
            className="text-base"
          />
        </div>

        <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Salvar o dia
        </Button>
      </form>
    </div>
  );
}
