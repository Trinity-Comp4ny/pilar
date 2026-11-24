import { useState } from "react";
import { APP_URL } from "./config";

// Cookie não sensível que src/contexts/AuthContext.tsx escreve em .pilarsoft.com.br; só um hint pra trocar o CTA, quem autentica de verdade é o redirect de sessão do app.
const LOGIN_HINT_COOKIE = "pilar_logged_hint";

function readLoginHint(): boolean {
  return document.cookie.split("; ").some((entry) => entry === `${LOGIN_HINT_COOKIE}=1`);
}

export function useLoginHint(): boolean {
  const [loggedIn] = useState(readLoginHint);
  return loggedIn;
}

export interface Acesso {
  logado: boolean;
  rotulo: "Entrar";
  href: string;
  /** Nome do evento de CTA no analytics. */
  evento: "entrar";
}

/**
 * O botão de acesso ao app (header, menu do celular e rodapé). O rótulo é sempre
 * "Entrar": "Abrir Pilar" confundia quem chegava pela primeira vez, e quem já tem
 * conta reconhece o Entrar (DECISOES.md, 2026-11-24). Com o hint de sessão o
 * destino pula o login e vai direto ao início.
 */
export function useAcesso(): Acesso {
  const logado = useLoginHint();
  return {
    logado,
    rotulo: "Entrar",
    href: logado ? `${APP_URL}/inicio` : `${APP_URL}/login`,
    evento: "entrar",
  };
}
