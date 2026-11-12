import { formatDateTime } from "@/lib/format";

const SHA = /^[0-9a-f]{8,}$/i;

/**
 * Texto da versão em uso, para o suporte perguntar "qual versão aparece aí?".
 * `release` é o __SENTRY_RELEASE__ (SHA do commit no deploy, "dev" fora dele) e
 * `buildTime` o __BUILD_TIME__ (ISO). SHA longo vira os 7 primeiros caracteres,
 * como o GitHub mostra.
 */
export function descreverVersao(release: string | undefined, buildTime: string | undefined): string {
  if (!release || release === "dev") return "Versão de desenvolvimento";
  const curto = SHA.test(release) ? release.slice(0, 7) : release;
  const data = formatDateTime(buildTime);
  return data === "-" ? `Versão ${curto}` : `Versão ${curto} · ${data}`;
}

/** Lê o que o build injetou. `typeof` protege teste e ambiente sem o `define`. */
export function versaoAtual(): string {
  const release = typeof __SENTRY_RELEASE__ === "string" ? __SENTRY_RELEASE__ : undefined;
  const buildTime = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : undefined;
  return descreverVersao(release, buildTime);
}
