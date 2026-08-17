// Tag "último método usado" (spec 039). Por dispositivo, sem PII: guarda só qual
// método o usuário usou no último login bem-sucedido, para a tela de login
// destacar a opção. Device pode ser compartilhado, então nunca expõe identidade.

export type MetodoLogin = "google" | "senha";

const KEY = "pilar:ultimo-login";

interface RegistroLogin {
  metodo: MetodoLogin;
  ts: number;
}

export function marcarLogin(metodo: MetodoLogin): void {
  try {
    const registro: RegistroLogin = { metodo, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(registro));
  } catch {
    // localStorage indisponível (modo privado / cota): a tag é cosmética, ignora.
  }
}

export function ultimoMetodo(): MetodoLogin | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegistroLogin>;
    if (parsed.metodo === "google" || parsed.metodo === "senha") return parsed.metodo;
    return null;
  } catch {
    return null;
  }
}
