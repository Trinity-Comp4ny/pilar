import { useState } from "react";
import { Camera, CloudOff, Mic, RotateCw, Trash2 } from "lucide-react";
import { AvatarStack } from "@/components/AvatarStack";
import { BusyMark } from "@/components/motion/BusyMark";
import { Button } from "@/components/ui/button";
import {
  PERGUNTA_EFETIVO,
  PERGUNTA_SEM_FALA,
  chipsDoExtraido,
  formatarDuracao,
  mensagemDoErro,
  type TomChip,
} from "@/lib/registrosObra";
import { cn } from "@/lib/utils";
import { ArquivosDoRegistro } from "./ArquivosDoRegistro";
import type { RegistroView } from "./registrosView";

const TOM_CHIP: Record<TomChip, string> = {
  neutro: "bg-muted text-ink-soft",
  positivo: "bg-positive/10 text-positive-strong",
  atencao: "bg-warning-soft text-warning-strong",
};

const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function horaLocal(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  registro: RegistroView;
  onReprocessar: (registroId: string) => void;
  reprocessando: boolean;
  onResponderEfetivo: (registroId: string, quantidade: number) => void;
  onDescartar: (chave: string) => void;
}

/**
 * Um registro na timeline do Pilar Campo (SPEC 135). Aparece na hora que a pessoa para de
 * gravar, ainda só no aparelho, e vai se completando: enviado, organizando, pronto. Nunca
 * some e nunca mostra erro técnico: quando algo falha, o registro continua salvo.
 */
export function RegistroCardCampo({
  registro: r,
  onReprocessar,
  reprocessando,
  onResponderEfetivo,
  onDescartar,
}: Props) {
  const [pulou, setPulou] = useState(false);
  const chips = chipsDoExtraido(r.extraido);
  const organizando = r.estado === "enviado" || r.estado === "organizando";
  const perguntaDeEfetivo =
    r.meu && r.estado === "pronto" && r.extraido?.pergunta === PERGUNTA_EFETIVO && r.id && !pulou;
  const semFala = r.estado === "pronto" && r.extraido?.pergunta === PERGUNTA_SEM_FALA;

  return (
    <article
      className="space-y-3 rounded-2xl border border-black/5 bg-white p-4"
      aria-busy={organizando || r.estado === "local"}
      data-estado={r.estado}
    >
      <header className="flex items-center gap-2.5">
        <AvatarStack pessoas={[{ nome: r.autorNome }]} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{r.meu ? "Você" : r.autorNome}</p>
          <p className="text-xs text-muted-foreground">{horaLocal(r.criadoEm)}</p>
        </div>
        <EstadoDoRegistro registro={r} />
      </header>

      {r.meu && r.id && (r.temAudio || r.fotos > 0) && (
        <ArquivosDoRegistro registroId={r.id} temAudio={r.temAudio} duracaoS={r.duracaoS} fotos={r.fotos} />
      )}

      {!(r.meu && r.id) && (r.temAudio || r.fotos > 0) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.temAudio && (
            <span className="inline-flex items-center gap-1">
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              {r.duracaoS !== null ? formatarDuracao(r.duracaoS) : "Áudio"}
            </span>
          )}
          {r.fotos > 0 && (
            <span className="inline-flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              {r.fotos} {r.fotos === 1 ? "foto" : "fotos"}
            </span>
          )}
        </p>
      )}

      {r.texto ? (
        <p className="text-[15px] leading-relaxed text-ink">{r.texto}</p>
      ) : organizando ? (
        <div className="space-y-2" aria-hidden="true">
          <span className="block h-3 w-11/12 rounded-full bg-muted" />
          <span className="block h-3 w-3/4 rounded-full bg-muted" />
          <span className="block h-3 w-1/2 rounded-full bg-muted/60" />
        </div>
      ) : null}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <li key={c.id} className={cn("rounded-lg px-2.5 py-1 text-[13px] font-medium", TOM_CHIP[c.tom])}>
              {c.texto}
            </li>
          ))}
        </ul>
      )}

      {semFala && (
        <p className="text-sm text-muted-foreground">Não ouvimos fala neste áudio. Grave de novo se for importante.</p>
      )}

      {perguntaDeEfetivo && r.id && (
        <div className="space-y-2 rounded-xl border border-warning-soft-border bg-warning-soft/50 p-3">
          <p className="text-sm font-semibold text-ink">{PERGUNTA_EFETIVO}</p>
          <div className="flex flex-wrap gap-1.5">
            {NUMEROS.map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                className="h-11 min-w-11 rounded-xl px-0 text-base"
                onClick={() => onResponderEfetivo(r.id as string, n)}
              >
                {n}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl px-3 text-sm text-muted-foreground"
              onClick={() => setPulou(true)}
            >
              Pular
            </Button>
          </div>
        </div>
      )}

      {r.estado === "falhou" && r.id && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{mensagemDoErro(r.erro)}</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl text-sm"
            loading={reprocessando}
            onClick={() => onReprocessar(r.id as string)}
          >
            <RotateCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Tentar de novo
          </Button>
        </div>
      )}

      {r.estado === "bloqueado" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{r.erro ?? "Não deu para enviar este registro."}</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl text-sm"
            onClick={() => onDescartar(r.chave)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Descartar
          </Button>
        </div>
      )}
    </article>
  );
}

function EstadoDoRegistro({ registro: r }: { registro: RegistroView }) {
  if (r.estado === "organizando" || r.estado === "enviado") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-ink">
        <BusyMark className="h-3 w-3" />
        Organizando
      </span>
    );
  }
  if (r.estado === "local") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">
        {r.semSinal ? <CloudOff className="h-3 w-3" aria-hidden="true" /> : <BusyMark className="h-3 w-3" />}
        {r.semSinal ? "Esperando sinal" : "Enviando"}
      </span>
    );
  }
  if (r.estado === "falhou") {
    return (
      <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger-mid">
        Não organizado
      </span>
    );
  }
  if (r.estado === "bloqueado") {
    return (
      <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger-mid">Não enviado</span>
    );
  }
  return null;
}
