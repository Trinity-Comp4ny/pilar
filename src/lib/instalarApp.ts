import { analytics } from "./analytics";

/**
 * Instalar o Pilar na tela inicial do celular (PWA).
 *
 * O Pilar já é instalável (manifest, ícones e service worker). Aqui fica o que
 * convida a pessoa a instalar, porque cada sistema faz de um jeito:
 *
 * - Android (Chrome, Edge, Samsung Internet): o navegador dispara
 *   `beforeinstallprompt` quando o app pode ser instalado. Guardamos o evento e
 *   o botão "Instalar" abre a janela nativa, num toque.
 * - iPhone/iPad: a Apple não deixa o site abrir a instalação. O caminho é o
 *   menu Compartilhar → "Adicionar à Tela de Início", então mostramos os passos.
 * - Android sem o evento (Firefox, ou o Chrome ainda não liberou): passos pelo
 *   menu do navegador.
 *
 * O evento chega cedo, muitas vezes antes de qualquer tela montar. Por isso a
 * escuta começa no `main.tsx` (`iniciarCapturaInstalacao`) e o estado vive aqui,
 * fora do React; as telas leem por `useInstalarApp`.
 */

/** Evento do Chromium, sem tipo no lib.dom. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PlataformaInstalacao =
  /** Já aberto como app (tela inicial): não há o que convidar. */
  | "instalado"
  /** iPhone ou iPad: passos pelo Compartilhar. */
  | "ios"
  /** Android: botão nativo quando o navegador libera, senão passos pelo menu. */
  | "android"
  /** Computador e o resto: o convite não aparece. */
  | "outro";

interface AmbienteNavegador {
  userAgent: string;
  /** `navigator.maxTouchPoints`: o iPad com iPadOS se apresenta como Mac. */
  maxTouchPoints?: number;
  /** `display-mode: standalone` (Android e iOS recente). */
  standalone?: boolean;
  /** `navigator.standalone` (Safari do iOS, legado mas ainda o mais confiável lá). */
  iosStandalone?: boolean;
}

export function detectarPlataforma(amb: AmbienteNavegador): PlataformaInstalacao {
  if (amb.standalone || amb.iosStandalone) return "instalado";
  const ua = amb.userAgent;
  const ehIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (amb.maxTouchPoints ?? 0) > 1);
  if (ehIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "outro";
}

function lerAmbiente(): AmbienteNavegador {
  if (typeof window === "undefined") return { userAgent: "" };
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent ?? "",
    maxTouchPoints: nav.maxTouchPoints,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    iosStandalone: nav.standalone === true,
  };
}

// ---------------------------------------------------------------------------
// Estado compartilhado (fora do React)

interface EstadoInstalacao {
  plataforma: PlataformaInstalacao;
  /** Evento guardado do Android: existe quando o botão nativo pode abrir. */
  promptNativo: BeforeInstallPromptEvent | null;
}

let estado: EstadoInstalacao = { plataforma: "outro", promptNativo: null };
let iniciado = false;
const ouvintes = new Set<() => void>();

function atualizar(parcial: Partial<EstadoInstalacao>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((fn) => fn());
}

export function lerEstadoInstalacao(): EstadoInstalacao {
  return estado;
}

export function assinarInstalacao(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

/** Chamado uma vez no boot, antes do React, para não perder o evento do Android. */
export function iniciarCapturaInstalacao(): void {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  estado = { plataforma: detectarPlataforma(lerAmbiente()), promptNativo: null };

  window.addEventListener("beforeinstallprompt", (e) => {
    // Sem o preventDefault o Chrome mostra a própria barrinha, fora de hora.
    e.preventDefault();
    atualizar({ promptNativo: e as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => {
    analytics.track("app_instalado", { publico: publicoDaRota(window.location.pathname) });
    atualizar({ plataforma: "instalado", promptNativo: null });
  });
}

/**
 * Abre a janela nativa de instalação (Android). Devolve `true` se a pessoa
 * aceitou. O evento só pode ser usado uma vez: depois dele, o botão volta aos
 * passos pelo menu até o navegador liberar outro.
 */
export async function abrirInstalacaoNativa(): Promise<boolean> {
  const evento = estado.promptNativo;
  if (!evento) return false;
  atualizar({ promptNativo: null });
  try {
    await evento.prompt();
    const escolha = await evento.userChoice;
    return escolha.outcome === "accepted";
  } catch {
    return false;
  }
}

/** Só para testes: volta ao estado inicial. */
export function __reiniciarInstalacaoParaTeste(novo?: Partial<EstadoInstalacao>): void {
  iniciado = false;
  estado = { plataforma: "outro", promptNativo: null, ...novo };
  ouvintes.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Convite dispensado (por navegador)

const CHAVE_DISPENSADO = "pilar:instalar-app:dispensado";
/** Quem fecha o convite volta a vê-lo depois de 60 dias; o item do menu fica sempre. */
const VOLTA_EM_MS = 60 * 24 * 60 * 60 * 1000;

export function conviteDispensado(agora = Date.now()): boolean {
  try {
    const quando = Number(localStorage.getItem(CHAVE_DISPENSADO));
    return Number.isFinite(quando) && quando > 0 && agora - quando < VOLTA_EM_MS;
  } catch {
    return false;
  }
}

export function dispensarConvite(agora = Date.now()): void {
  try {
    localStorage.setItem(CHAVE_DISPENSADO, String(agora));
  } catch {
    // localStorage indisponível (modo privado): o convite volta na próxima visita.
  }
}

// ---------------------------------------------------------------------------
// Manifest por público: o escritório abre em /inicio, o cliente no portal.

export type PublicoApp = "escritorio" | "portal";

export const MANIFEST_POR_PUBLICO: Record<PublicoApp, { href: string; titulo: string }> = {
  escritorio: { href: "/manifest.webmanifest", titulo: "Pilar" },
  portal: { href: "/manifest-portal.webmanifest", titulo: "Pilar Portal" },
};

export function publicoDaRota(pathname: string): PublicoApp {
  return pathname === "/cliente" || pathname.startsWith("/cliente/") ? "portal" : "escritorio";
}
