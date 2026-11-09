import { useCallback, useEffect, useRef, useState } from "react";

/** Teto do áudio (ADR 0062): 3 minutos. */
export const LIMITE_GRAVACAO_S = 180;
/** A partir daqui a tela avisa que o limite está perto. */
export const AVISO_LIMITE_S = 160;
const N_BARRAS = 19;

export interface GravacaoPronta {
  blob: Blob;
  mimeType: string;
  duracaoS: number;
}

export type EstadoGravador = "ocioso" | "pedindo" | "gravando";

/** O que o hook usa do navegador. Em teste entra um falso (jsdom não tem microfone). */
export interface DepsGravador {
  getUserMedia(): Promise<MediaStream>;
  criarRecorder(stream: MediaStream, mimeType: string): MediaRecorder;
  mimeSuportado(mimeType: string): boolean;
  agora(): number;
}

const depsReais: DepsGravador = {
  getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
  criarRecorder: (stream, mimeType) => (mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)),
  mimeSuportado: (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m) === true,
  agora: () => Date.now(),
};

const CANDIDATOS_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Primeiro formato que este aparelho grava (webm no Chrome, mp4 no Safari); "" deixa o navegador escolher. */
export function escolherMimeAudio(suporta: (m: string) => boolean): string {
  return CANDIDATOS_MIME.find(suporta) ?? "";
}

/** Texto para o erro do microfone: o que houve e o que fazer. */
export function mensagemDoMicrofone(e: unknown): string {
  const nome = (e as { name?: string } | null)?.name;
  if (nome === "NotAllowedError" || nome === "SecurityError") {
    return "O microfone está bloqueado. Libere o microfone nas configurações do navegador e tente de novo.";
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") {
    return "Este aparelho não tem microfone disponível.";
  }
  return "Não deu para começar a gravar. Tente de novo.";
}

interface Opcoes {
  /** Chamado quando a gravação termina (botão ou limite de tempo) com o áudio pronto. */
  onPronta: (g: GravacaoPronta) => void;
  limiteS?: number;
  deps?: DepsGravador;
}

/**
 * Gravador de áudio do Pilar Campo: MediaRecorder + tempo + barras de volume reais (um
 * AnalyserNode no mesmo stream, não uma animação solta) + corte nos 3 minutos. Mantém a tela
 * acesa enquanto grava (tela que apaga no celular interrompe a captura).
 */
export function useGravadorAudio({ onPronta, limiteS = LIMITE_GRAVACAO_S, deps = depsReais }: Opcoes) {
  const [estado, setEstado] = useState<EstadoGravador>("ocioso");
  const [segundos, setSegundos] = useState(0);
  const [niveis, setNiveis] = useState<number[]>(() => new Array(N_BARRAS).fill(0.1));
  const [erro, setErro] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inicioRef = useRef(0);
  const canceladoRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const onProntaRef = useRef(onPronta);
  useEffect(() => {
    onProntaRef.current = onPronta;
  }, [onPronta]);

  const limparTudo = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (limiteRef.current) clearTimeout(limiteRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    tickRef.current = limiteRef.current = rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setNiveis(new Array(N_BARRAS).fill(0.1));
  }, []);

  const iniciarOnda = useCallback((stream: MediaStream) => {
    if (typeof AudioContext === "undefined") return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    const dados = new Uint8Array(analyser.frequencyBinCount);
    const grupo = Math.max(1, Math.floor(dados.length / N_BARRAS));
    const tick = () => {
      analyser.getByteFrequencyData(dados);
      setNiveis(
        Array.from({ length: N_BARRAS }, (_, i) => {
          const fatia = dados.slice(i * grupo, (i + 1) * grupo);
          const media = fatia.reduce((a, b) => a + b, 0) / (fatia.length || 1);
          return Math.max(0.1, Math.min(1, media / 150));
        })
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const iniciar = useCallback(async () => {
    if (estado !== "ocioso") return;
    setErro(null);
    setEstado("pedindo");
    canceladoRef.current = false;
    try {
      const stream = await deps.getUserMedia();
      const mimeType = escolherMimeAudio(deps.mimeSuportado);
      const recorder = deps.criarRecorder(stream, mimeType);
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const duracaoS = Math.min(limiteS, Math.max(0, Math.round((deps.agora() - inicioRef.current) / 1000)));
        const cancelado = canceladoRef.current;
        const tipoFinal = recorder.mimeType || mimeType || "audio/webm";
        limparTudo();
        setEstado("ocioso");
        setSegundos(0);
        if (cancelado) {
          canceladoRef.current = false;
          return;
        }
        onProntaRef.current({ blob: new Blob(chunksRef.current, { type: tipoFinal }), mimeType: tipoFinal, duracaoS });
      };
      recorderRef.current = recorder;
      inicioRef.current = deps.agora();
      recorder.start();
      setEstado("gravando");
      setSegundos(0);
      iniciarOnda(stream);
      tickRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
      limiteRef.current = setTimeout(() => recorderRef.current?.stop(), limiteS * 1000);
      const wl = (
        navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }
      ).wakeLock;
      wl?.request("screen")
        .then((lock) => {
          wakeLockRef.current = lock;
        })
        .catch(() => {});
    } catch (e) {
      limparTudo();
      setEstado("ocioso");
      setErro(mensagemDoMicrofone(e));
    }
  }, [estado, deps, limiteS, limparTudo, iniciarOnda]);

  const parar = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  /** Descarta a gravação em andamento, sem entregar áudio. */
  const cancelar = useCallback(() => {
    canceladoRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else limparTudo();
  }, [limparTudo]);

  // Sair da tela no meio da gravação descarta e solta o microfone.
  useEffect(
    () => () => {
      canceladoRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      else limparTudo();
    },
    [limparTudo]
  );

  return { estado, segundos, niveis, erro, avisoLimite: segundos >= AVISO_LIMITE_S, iniciar, parar, cancelar };
}
