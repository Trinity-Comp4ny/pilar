// O anel do boot (#boot no index.html, pintado por /boot-ring.js) cobre a tela
// enquanto o JavaScript baixa. Quem tira é o React, quando a primeira tela pinta.

declare global {
  interface Window {
    __pilarBootStop?: () => void;
  }
}

const BOOT_ID = "boot";
const FADE_MS = 360;

/** O boot ainda está na tela e não começou a sair. */
export const bootIsShowing = (): boolean => {
  const el = typeof document === "undefined" ? null : document.getElementById(BOOT_ID);
  return Boolean(el && !el.dataset.leaving);
};

/** Troca a legenda do boot (ex.: "Abrindo VRZ Engenharia") sem tirar o anel. */
export const setBootCaption = (text: string): void => {
  const caption = document.getElementById("boot-caption");
  if (caption) caption.textContent = text;
};

/** Tira o boot com fade de 360ms e para o anel. Chamar mais de uma vez é seguro. */
export const dismissBoot = (): void => {
  const el = document.getElementById(BOOT_ID);
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = "1";
  const remove = () => {
    window.__pilarBootStop?.();
    el.remove();
  };
  requestAnimationFrame(() => {
    el.style.opacity = "0";
    window.setTimeout(remove, FADE_MS + 40);
  });
};
