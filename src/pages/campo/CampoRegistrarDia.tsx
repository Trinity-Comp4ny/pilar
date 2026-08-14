import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CLIMA_OPCOES } from "@/lib/obras";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getCampoToken } from "./useCampoAuth";
import { filaOfflineDb } from "./campoOfflineDb";
import type { FilaDiaPayload, FilaFoto } from "./campoOfflineQueue";

const hoje = () => new Date().toISOString().slice(0, 10);

interface FotoLocal {
  file: File;
  preview: string;
}

// Comprime a foto no cliente (max 1600px, JPEG 0.8): essencial para subir em 4G
// ruim de canteiro. Devolve base64 puro (sem o prefixo data:) para a edge.
async function comprimir(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.8));
  if (!blob) throw new Error("blob");
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1] ?? "");
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(blob);
  });
}

export default function CampoRegistrarDia() {
  usePageTitle("Pilar Campo | Registrar o dia");
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(hoje());
  const [clima, setClima] = useState<string | null>(null);
  const [efetivo, setEfetivo] = useState("");
  const [atividades, setAtividades] = useState("");
  const [ocorrencias, setOcorrencias] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [saving, setSaving] = useState(false);

  const addFotos = (files: FileList | null) => {
    if (!files) return;
    const novas = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFotos((prev) => [...prev, ...novas]);
  };
  const removerFoto = (i: number) => {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, k) => k !== i);
    });
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getCampoToken();
    if (!token) {
      navigate("/campo/login", { replace: true });
      return;
    }

    const dia: FilaDiaPayload = {
      p_data: data,
      p_clima: clima,
      p_condicao: null,
      p_efetivo: efetivo.trim() === "" ? null : Number(efetivo),
      p_atividades: atividades,
      p_ocorrencias: ocorrencias,
      p_pendencias: null,
    };

    // Comprime antes de decidir online/offline: o arquivo original some quando
    // sair da tela, então a versão a subir precisa estar pronta nos dois casos.
    let fotosComprimidas: FilaFoto[] = [];
    setSaving(true);
    try {
      fotosComprimidas = await Promise.all(
        fotos.map(async (f) => ({ contentType: "image/jpeg", imageBase64: await comprimir(f.file), enviada: false }))
      );

      if (!navigator.onLine) {
        await enfileirarOffline(dia, fotosComprimidas);
        toast.success("Sem conexão agora", {
          description: "Salvo no aparelho. Envia sozinho quando a internet voltar.",
        });
        navigate("/campo", { replace: true });
        return;
      }

      const { data: res, error } = await callUntypedRpc<{ ok: boolean; erro?: string; rdo_id?: string }>(
        "campo_salvar_rdo",
        { p_token: token, ...dia }
      );
      if (error) throw error;
      if (!res?.ok || !res.rdo_id) {
        toast.error("Não foi possível registrar", { description: res?.erro ?? "Tente de novo" });
        return;
      }

      // Sobe as fotos comprimidas. Falha parcial não perde o dia nem reenvia o
      // que já subiu: a foto que falhou fica na fila (com o rdo_id já criado).
      const fotosAtualizadas = [...fotosComprimidas];
      let falhas = 0;
      for (let i = 0; i < fotosAtualizadas.length; i++) {
        const { data: up, error: upErr } = await supabase.functions.invoke("campo-upload-foto", {
          body: {
            token,
            rdo_id: res.rdo_id,
            image_base64: fotosAtualizadas[i].imageBase64,
            content_type: fotosAtualizadas[i].contentType,
          },
        });
        if (!upErr && (up as { success?: boolean } | null)?.success) {
          fotosAtualizadas[i] = { ...fotosAtualizadas[i], enviada: true };
        } else {
          falhas++;
        }
      }

      if (falhas > 0) {
        await enfileirarOffline(dia, fotosAtualizadas, res.rdo_id);
        toast.warning(`Dia salvo, mas ${falhas} foto${falhas > 1 ? "s" : ""} não subiu`, {
          description: "Vamos tentar de novo automaticamente.",
        });
      } else {
        toast.success("Dia registrado");
      }
      navigate("/campo", { replace: true });
    } catch {
      // Falha de rede no meio do caminho: não perde o que foi preenchido.
      await enfileirarOffline(dia, fotosComprimidas);
      toast.success("Sem conexão agora", {
        description: "Salvo no aparelho. Envia sozinho quando a internet voltar.",
      });
      navigate("/campo", { replace: true });
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

        <div className="space-y-2">
          <Label>Fotos do serviço</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              addFotos(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={f.preview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerFoto(i)}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/15 bg-muted/40 text-muted-foreground"
            >
              <Camera className="h-6 w-6" />
              <span className="text-[11px]">Foto</span>
            </button>
          </div>
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

/** Grava o dia na fila offline (IndexedDB) para o `useCampoSync` reenviar depois. */
async function enfileirarOffline(dia: FilaDiaPayload, fotos: FilaFoto[], rdoId?: string): Promise<void> {
  await filaOfflineDb.salvar({
    id: crypto.randomUUID(),
    criadoEm: Date.now(),
    dia,
    fotos,
    rdoId,
    tentativas: 0,
  });
}
