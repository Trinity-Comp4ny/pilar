import { useState } from "react";

// Cookie não sensível que src/contexts/AuthContext.tsx escreve em .pilarsoft.com.br; só um hint pra trocar o CTA, quem autentica de verdade é o redirect de sessão do app.
const LOGIN_HINT_COOKIE = "pilar_logged_hint";

function readLoginHint(): boolean {
  return document.cookie.split("; ").some((entry) => entry === `${LOGIN_HINT_COOKIE}=1`);
}

export function useLoginHint(): boolean {
  const [loggedIn] = useState(readLoginHint);
  return loggedIn;
}
