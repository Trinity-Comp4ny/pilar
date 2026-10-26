import { env } from "@/lib/env";

/**
 * Plataforma de marketing (SPEC 128, ADR 0061): produto próprio, no repo post-automation.
 * Campanhas, posts, vídeos e analytics vivem lá; o Pilar só abre e devolve o funil por UTM.
 */
export const MARKETING_APP_URL = env.VITE_MARKETING_APP_URL ?? "https://post-automation.vercel.app";
