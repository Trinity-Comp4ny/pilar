import { useState } from "react";
import { Camera, Mic } from "lucide-react";
import { BusyMark } from "@/components/motion/BusyMark";
import { Button } from "@/components/ui/button";
import { formatarDuracao } from "@/lib/registrosObra";
import { buscarArquivosDoRegistro, type ArquivosDoRegistro as Arquivos } from "./buscarArquivosDoRegistro";

/** A URL assinada vale 5 minutos; passado isto busca outra em vez de tocar um link vencido. */
const VALIDADE_MS = 4 * 60 * 1000;

type Alvo = "audio" | "fotos";

/**
 * Fotos e áudio do PRÓPRIO registro no cartão do Pilar Campo (SPEC 135). Nada é baixado até a
 * pessoa tocar: a lista não assina URL de registro nenhum, só o que ela abre.
 */
export function ArquivosDoRegistro({
  registroId,
  temAudio,
  duracaoS,
  fotos,
}: {
  registroId: string;
  temAudio: boolean;
  duracaoS: number | null;
  fotos: number;
}) {
  const [arquivos, setArquivos] = useState<Arquivos | null>(null);
  const [buscadoEm, setBuscadoEm] = useState(0);
  const [aberto, setAberto] = useState<Alvo | null>(null);
  const [carregando, setCarregando] = useState<Alvo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrir = async (alvo: Alvo) => {
    if (aberto === alvo) return setAberto(null);
    setErro(null);
    if (!arquivos || Date.now() - buscadoEm > VALIDADE_MS) {
      setCarregando(alvo);
      try {
        setArquivos(await buscarArquivosDoRegistro(registroId));
        setBuscadoEm(Date.now());
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não deu para abrir agora.");
        return;
      } finally {
        setCarregando(null);
      }
    }
    setAberto(alvo);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {temAudio && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void abrir("audio")}
            disabled={carregando !== null}
          >
            {carregando === "audio" ? (
              <BusyMark className="mr-1.5 h-4 w-4" />
            ) : (
              <Mic className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            {aberto === "audio" ? "Fechar áudio" : `Ouvir${duracaoS !== null ? ` (${formatarDuracao(duracaoS)})` : ""}`}
          </Button>
        )}
        {fotos > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void abrir("fotos")}
            disabled={carregando !== null}
          >
            {carregando === "fotos" ? (
              <BusyMark className="mr-1.5 h-4 w-4" />
            ) : (
              <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            {aberto === "fotos" ? "Fechar fotos" : fotos === 1 ? "Ver a foto" : `Ver as ${fotos} fotos`}
          </Button>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-xs text-danger-strong">
          {erro}
        </p>
      )}

      {aberto === "audio" && arquivos?.audioUrl && (
        <audio controls autoPlay src={arquivos.audioUrl} className="w-full" aria-label="Seu áudio" />
      )}
      {aberto === "audio" && arquivos && !arquivos.audioUrl && (
        <p className="text-xs text-muted-foreground">O áudio deste registro já não está guardado.</p>
      )}
      {aberto === "fotos" && arquivos && (
        <div className="grid grid-cols-3 gap-2">
          {arquivos.fotos.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Foto ${i + 1} do seu registro`}
              loading="lazy"
              className="aspect-square w-full rounded-xl object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}
