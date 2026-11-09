import { useEffect, useState } from "react";

/** Só o que usamos da Web Speech API (os tipos dela não vêm no TypeScript). */
interface ReconhecimentoFala {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type ConstrutorReconhecimento = new () => ReconhecimentoFala;

function construtor(win: Window): ConstrutorReconhecimento | null {
  const w = win as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * A prévia do texto durante a gravação é uma cortesia, nunca o texto final (o servidor transcreve).
 * No iPhone o reconhecimento de fala disputa o microfone com o MediaRecorder e pode silenciar a
 * gravação, então lá ela fica desligada: gravar vale mais que mostrar o texto ao vivo.
 */
export function falaAoVivoSuportada(win: Window = window, userAgent: string = navigator.userAgent): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return false;
  return construtor(win) !== null;
}

/** Junta os pedaços de resultado do reconhecimento num texto só (os finais e o parcial em curso). */
export function montarTextoDaFala(resultados: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>): string {
  let texto = "";
  for (let i = 0; i < resultados.length; i++) texto += resultados[i][0].transcript;
  return texto.trim();
}

/**
 * Texto ao vivo enquanto `ativo`. O Chrome encerra o reconhecimento sozinho depois de um
 * silêncio; enquanto estiver ativo reinicia para a prévia seguir até o fim da gravação.
 */
export function useFalaAoVivo(ativo: boolean): { texto: string; suportada: boolean } {
  const [texto, setTexto] = useState("");
  const suportada = typeof window !== "undefined" && falaAoVivoSuportada();

  useEffect(() => {
    if (!ativo || !suportada) return;
    const Reconhecimento = construtor(window);
    if (!Reconhecimento) return;

    let vivo = true;
    // Cada sessão do reconhecimento recomeça os resultados; o que veio antes fica guardado.
    let acumulado = "";
    let rec: ReconhecimentoFala | null = null;

    const abrir = () => {
      if (!vivo) return;
      try {
        rec = new Reconhecimento();
        rec.lang = "pt-BR";
        rec.continuous = true;
        rec.interimResults = true;
        let daSessao = "";
        rec.onresult = (e) => {
          daSessao = montarTextoDaFala(e.results);
          setTexto(`${acumulado} ${daSessao}`.trim());
        };
        rec.onend = () => {
          acumulado = `${acumulado} ${daSessao}`.trim();
          abrir();
        };
        rec.onerror = () => {};
        rec.start();
      } catch {
        // Sem prévia: a gravação segue normalmente.
      }
    };
    abrir();

    return () => {
      vivo = false;
      if (rec) {
        rec.onend = null;
        try {
          rec.stop();
        } catch {
          // já parado
        }
      }
      setTexto("");
    };
  }, [ativo, suportada]);

  return { texto, suportada };
}
