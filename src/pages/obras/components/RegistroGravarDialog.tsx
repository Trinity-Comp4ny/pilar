import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Pencil, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { LIMITE_GRAVACAO_S, useGravadorAudio, type GravacaoPronta } from "@/hooks/useGravadorAudio";
import { comprimirFoto } from "@/lib/comprimirFoto";
import { dataLocalIso, formatarDuracao } from "@/lib/registrosObra";
import { cn } from "@/lib/utils";
import { useCriarRegistro } from "@/pages/obras/hooks/useObraRegistros";

type Modo = "voz" | "foto" | "texto";

const MODOS: ViewOption<Modo>[] = [
  { value: "voz", label: "Voz", icon: Mic },
  { value: "foto", label: "Foto", icon: Camera },
  { value: "texto", label: "Texto", icon: Pencil },
];

/** Gravação menor que isto é toque sem querer. */
const DURACAO_MINIMA_S = 2;
const MAX_FOTOS = 6;

interface Foto {
  blob: Blob;
  preview: string;
}

/**
 * Gravar registro pelo escritório (SPEC 135, BEZ-55): voz, foto ou texto, na aba Diário. Tudo o que
 * estiver preenchido vai junto. Envia e fecha: a edge responde na hora e a IA organiza depois,
 * então o registro aparece na timeline como "Organizando".
 */
export function RegistroGravarDialog({
  open,
  onOpenChange,
  obraId,
  onEnviado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  /** Chamado depois que a edge aceitou o registro (a aba leva o gestor para a visão Registros). */
  onEnviado?: () => void;
}) {
  const criar = useCriarRegistro(obraId);
  const [modo, setModo] = useState<Modo>("voz");
  const [audio, setAudio] = useState<GravacaoPronta | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const clientId = useRef(crypto.randomUUID());
  const entradaFoto = useRef<HTMLInputElement>(null);

  const gravador = useGravadorAudio({
    onPronta: (g) => {
      if (g.duracaoS < DURACAO_MINIMA_S) {
        toast.info("Gravação muito curta", { description: "Segure um pouco mais e fale o que aconteceu." });
        return;
      }
      setAudio(g);
    },
  });

  useEffect(() => {
    if (!audio) return setAudioUrl(null);
    const url = URL.createObjectURL(audio.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  const limpar = () => {
    gravador.cancelar();
    fotos.forEach((f) => URL.revokeObjectURL(f.preview));
    setModo("voz");
    setAudio(null);
    setFotos([]);
    setTexto("");
    setErro(null);
    clientId.current = crypto.randomUUID();
  };

  const fechar = (v: boolean) => {
    if (!v) limpar();
    onOpenChange(v);
  };

  const adicionarFotos = async (arquivos: FileList | null) => {
    if (!arquivos) return;
    const vagas = MAX_FOTOS - fotos.length;
    const novas: Foto[] = [];
    for (const file of Array.from(arquivos).slice(0, vagas)) {
      try {
        const blob = await comprimirFoto(file);
        novas.push({ blob, preview: URL.createObjectURL(blob) });
      } catch {
        toast.error("Não deu para ler uma das fotos", { description: "Escolha outra imagem." });
      }
    }
    setFotos((atual) => [...atual, ...novas]);
    if (entradaFoto.current) entradaFoto.current.value = "";
  };

  const textoLimpo = texto.trim();
  const temConteudo = Boolean(audio) || fotos.length > 0 || textoLimpo.length > 0;

  const enviar = async () => {
    setErro(null);
    try {
      await criar.mutateAsync({
        clientId: clientId.current,
        data: dataLocalIso(),
        texto: textoLimpo || undefined,
        audio: audio ? { blob: audio.blob, mimeType: audio.mimeType, duracaoS: audio.duracaoS } : undefined,
        fotos: fotos.map((f) => f.blob),
      });
      toast.success("Registro enviado", { description: "A IA organiza em instantes." });
      onEnviado?.();
      fechar(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Sem conexão com o servidor");
    }
  };

  const gravando = gravador.estado === "gravando";

  return (
    <FormDialog
      open={open}
      onOpenChange={fechar}
      title="Gravar registro"
      description="Fale, fotografe ou escreva o que aconteceu na obra. A IA organiza depois que você enviar."
      onSubmit={() => void enviar()}
      submitLabel="Enviar registro"
      isPending={criar.isPending}
      submitDisabled={!temConteudo || gravando}
    >
      <div className="space-y-4">
        <ViewSwitcher options={MODOS} value={modo} onChange={setModo} ariaLabel="Como registrar" />

        {modo === "voz" && (
          <div className="rounded-2xl bg-muted/60 p-5 text-center">
            {audio && audioUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-ink">Áudio de {formatarDuracao(audio.duracaoS)}</p>
                <audio controls src={audioUrl} className="mx-auto w-full" />
                <Button type="button" variant="outline" size="sm" onClick={() => setAudio(null)}>
                  <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Regravar
                </Button>
              </div>
            ) : gravando ? (
              <div className="space-y-3">
                <p className="text-3xl font-bold tabular-nums text-ink">{formatarDuracao(gravador.segundos)}</p>
                <div className="flex h-9 items-center justify-center gap-1" aria-hidden="true">
                  {gravador.niveis.map((n, i) => (
                    <i
                      key={i}
                      className="block w-1 rounded-full bg-brand"
                      style={{ height: `${Math.round(n * 32)}px` }}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-14 w-14 rounded-full"
                  onClick={gravador.parar}
                  aria-label="Parar a gravação"
                >
                  <Square className="h-5 w-5" aria-hidden="true" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  {gravador.avisoLimite
                    ? `Quase no limite de ${formatarDuracao(LIMITE_GRAVACAO_S)}`
                    : "Toque para parar"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="brand"
                  onClick={() => void gravador.iniciar()}
                  disabled={gravador.estado === "pedindo"}
                >
                  <Mic className="mr-1.5 h-4 w-4" aria-hidden="true" /> Começar a gravar
                </Button>
                <p className="text-xs text-muted-foreground">Até {formatarDuracao(LIMITE_GRAVACAO_S)}.</p>
              </div>
            )}
            {gravador.erro && <p className="mt-3 text-sm text-danger-strong">{gravador.erro}</p>}
          </div>
        )}

        {modo === "foto" && (
          <div className="space-y-3">
            <input
              ref={entradaFoto}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void adicionarFotos(e.target.files)}
            />
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((f, i) => (
                  <div key={f.preview} className="relative">
                    <img
                      src={f.preview}
                      alt={`Foto ${i + 1} do registro`}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remover a foto ${i + 1}`}
                      onClick={() => {
                        URL.revokeObjectURL(f.preview);
                        setFotos((atual) => atual.filter((x) => x !== f));
                      }}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={fotos.length >= MAX_FOTOS}
              onClick={() => entradaFoto.current?.click()}
            >
              <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {fotos.length === 0 ? "Escolher fotos" : `Adicionar foto (${fotos.length} de ${MAX_FOTOS})`}
            </Button>
          </div>
        )}

        <div className={cn(modo === "texto" ? "block" : "hidden")}>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="O que aconteceu hoje na obra"
            maxLength={5000}
            rows={4}
            aria-label="Texto do registro"
          />
        </div>

        {modo !== "texto" && textoLimpo && (
          <p className="text-xs text-muted-foreground">Também vai o texto que você escreveu.</p>
        )}

        {erro && (
          <div role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-strong">
            {erro}. Toque em Enviar registro para tentar de novo.
          </div>
        )}
      </div>
    </FormDialog>
  );
}
