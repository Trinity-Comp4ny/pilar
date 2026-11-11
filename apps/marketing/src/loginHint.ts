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
  rotulo: "Entrar" | "Abrir Pilar";
  href: string;
  /** Nome do evento de CTA no analytics. */
  evento: "entrar" | "abrir_pilar";
}

/**
 * O botão de acesso ao app, o mesmo em toda a landing (header, menu do celular,
 * hero e fecho). Deslogado é "Entrar", que leva ao login; com o hint de sessão
 * vira "Abrir Pilar", direto para o início. Antes a hero dizia "Entrar" e o
 * header "Abrir Pilar" para a mesma pessoa, e o fecho mostrava os dois juntos.
 */
export function useAcesso(): Acesso {
  const logado = useLoginHint();
  return logado
    ? { logado, rotulo: "Abrir Pilar", href: `${APP_URL}/inicio`, evento: "abrir_pilar" }
    : { logado, rotulo: "Entrar", href: `${APP_URL}/login`, evento: "entrar" };
}
