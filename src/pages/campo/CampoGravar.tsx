import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Camera, Lightbulb, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { dataLocalIso, formatarDuracao } from "@/lib/registrosObra";
import { cn } from "@/lib/utils";
import { novoItemDeRegistro } from "./campoRegistroFila";
import { comprimirFoto } from "./fotoCampo";
import type { CampoAccount } from "./useCampoAuth";
import { useCampoSync } from "./useCampoSync";
import { useFalaAoVivo } from "./useFalaAoVivo";
import { LIMITE_GRAVACAO_S, useGravadorAudio, type GravacaoPronta } from "./useGravadorAudio";

/** Gravação menor que isto é toque sem querer: não vira registro. */
const DURACAO_MINIMA_S = 2;

const chaveAceite = (accountId: string) => `pilar_campo_aceite_audio:${accountId}`;

function jaAceitou(accountId: string): boolean {
  try {
    return localStorage.getItem(chaveAceite(accountId)) === "1";
  } catch {
    return false;
  }
}

interface FotoDoRegistro {
  blob: Blob;
  preview: string;
}

/**
 * Gravar um registro (SPEC 135). A pessoa fala, aperta "Parar e enviar" e sai: o registro é
 * guardado no aparelho na hora, sobe sozinho e a IA organiza depois. Não existe tela de espera.
 */
export default function CampoGravar() {
  usePageTitle("Gravar registro");
  const navigate = useNavigate();
  const { account } = useOutletContext<{ account: CampoAccount }>();
  const { registrar } = useCampoSync();

  const [aceitou, setAceitou] = useState(() => jaAceitou(account.account_id));
  const [fotos, setFotos] = useState<FotoDoRegistro[]>([]);
  const fotosRef = useRef<FotoDoRegistro[]>([]);
  const entradaFoto = useRef<HTMLInputElement>(null);

  const salvar = async (g: GravacaoPronta) => {
    if (g.duracaoS < DURACAO_MINIMA_S && fotosRef.current.length === 0) {
      toast.info("Gravação muito curta", { description: "Segure um pouco mais e fale o que foi feito." });
      navigate("/campo", { replace: true });
      return;
    }
    await registrar(
      novoItemDeRegistro({
        data: dataLocalIso(),
        audio: { blob: g.blob, mimeType: g.mimeType, duracaoS: g.duracaoS },
        fotos: fotosRef.current.map((f) => ({ blob: f.blob, contentType: "image/jpeg" })),
        aceiteAudio: true,
      })
    );
    toast.success("Registro salvo", { description: "Pode fechar o app. A gente envia e organiza." });
    navigate("/campo", { replace: true });
  };

  const gravador = useGravadorAudio({ onPronta: (g) => void salvar(g) });
  const fala = useFalaAoVivo(gravador.estado === "gravando");

  // Com o aviso já aceito, a gravação começa ao abrir a tela.
  const iniciouRef = useRef(false);
  useEffect(() => {
    if (aceitou && !iniciouRef.current) {
      iniciouRef.current = true;
      void gravador.iniciar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitou]);

  useEffect(
    () => () => {
      fotosRef.current.forEach((f) => URL.revokeObjectURL(f.preview));
    },
    []
  );

  const aceitarAviso = () => {
    try {
      localStorage.setItem(chaveAceite(account.account_id), "1");
    } catch {
      // sem armazenamento: o aviso volta na próxima vez, nada se perde
    }
    setAceitou(true);
  };

  const adicionarFoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await comprimirFoto(file);
      const nova = { blob, preview: URL.createObjectURL(blob) };
      fotosRef.current = [...fotosRef.current, nova];
      setFotos(fotosRef.current);
    } catch {
      toast.error("Não deu para usar essa foto", { description: "Tire outra." });
    }
  };

  const removerFoto = (i: number) => {
    URL.revokeObjectURL(fotosRef.current[i].preview);
    fotosRef.current = fotosRef.current.filter((_, idx) => idx !== i);
    setFotos(fotosRef.current);
  };

  const cancelar = () => {
    gravador.cancelar();
    navigate("/campo", { replace: true });
  };

  const gravando = gravador.estado === "gravando";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={cancelar} aria-label="Cancelar gravação">
          <X className="h-5 w-5" />
        </Button>
        <span
          className={cn(
            "flex items-center gap-2 text-sm font-semibold",
            gravando ? "text-danger-mid" : "text-muted-foreground"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              gravando ? "bg-danger shadow-[0_0_0_5px_hsl(var(--danger)/0.15)]" : "bg-muted-foreground/40"
            )}
          />
          {gravando ? "Gravando" : gravador.estado === "pedindo" ? "Abrindo o microfone" : "Pronto"}
        </span>
        <span className="w-12" />
      </header>

      <div className="flex justify-center pt-2">
        <span className="text-5xl font-semibold tabular-nums tracking-tight text-ink" aria-live="off">
          {formatarDuracao(gravador.segundos)}
        </span>
      </div>

      <div className="space-y-3 px-5 pt-4">
        {gravador.avisoLimite ? (
          <p role="status" className="rounded-2xl bg-warning-soft px-4 py-3 text-[15px] text-warning-strong">
            Falta pouco: o áudio para em {formatarDuracao(LIMITE_GRAVACAO_S)}. Termine e envie.
          </p>
        ) : (
          <p className="flex gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-[15px] leading-snug text-ink">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Pode falar quem trabalhou hoje, o que avançou e se faltou alguma coisa.</span>
          </p>
        )}
        {gravador.erro && (
          <div role="alert" className="space-y-2 rounded-2xl bg-danger-soft px-4 py-3">
            <p className="text-[15px] text-danger-strong">{gravador.erro}</p>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => void gravador.iniciar()}>
              Tentar de novo
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden px-6 pt-5">
        {fala.texto ? (
          <p className="text-xl leading-relaxed text-ink">{fala.texto}</p>
        ) : gravando ? (
          <p className="text-base text-muted-foreground">
            Fale normalmente. O texto organizado aparece depois de enviar.
          </p>
        ) : null}
      </div>

      <div aria-hidden="true" className="flex h-14 items-center justify-center gap-1 px-6">
        {gravador.niveis.map((n, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-ink transition-[height] duration-100"
            style={{ height: `${Math.round(n * 52)}px` }}
          />
        ))}
      </div>

      {fotos.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto px-5 pt-3">
          {fotos.map((f, i) => (
            <li key={f.preview} className="relative shrink-0">
              <img src={f.preview} alt={`Foto ${i + 1} deste registro`} className="h-16 w-16 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => removerFoto(i)}
                aria-label={`Remover foto ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <input
          ref={entradaFoto}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void adicionarFoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="icon"
          className="h-[60px] w-[60px] rounded-full"
          onClick={() => entradaFoto.current?.click()}
          disabled={fotos.length >= 6}
          aria-label="Tirar uma foto para este registro"
        >
          <Camera className="h-6 w-6" />
        </Button>

        <button
          type="button"
          onClick={gravador.parar}
          disabled={!gravando}
          className="flex flex-col items-center gap-2 disabled:opacity-40"
          aria-label="Parar e enviar"
        >
          <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-ink shadow-lg">
            <Square className="h-7 w-7 fill-brand text-brand" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-ink">Parar e enviar</span>
        </button>

        <span className="w-[60px]" aria-hidden="true" />
      </div>

      <FormDialog
        open={!aceitou}
        onOpenChange={(aberto) => {
          if (!aberto) navigate("/campo", { replace: true });
        }}
        size="sm"
        title="O áudio fica guardado"
        description="O áudio que você gravar fica guardado para a sua empresa poder ouvir de novo. Depois de 12 meses ele é apagado; o texto continua."
        submitLabel="Entendi, gravar"
        cancelLabel="Voltar"
        onSubmit={aceitarAviso}
      >
        <p className="text-sm text-ink-soft">Só a sua empresa ouve. O cliente da obra nunca ouve o áudio.</p>
      </FormDialog>
    </div>
  );
}
