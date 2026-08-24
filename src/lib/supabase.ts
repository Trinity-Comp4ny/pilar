import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { env } from "./env";
import { createInstrumentedFetch } from "./supabaseFetch";

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase environment variables not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

// Quando "lembrar-me" está desmarcado, a flag pilar-remember-me='false' é
// gravada em localStorage antes do login. O storage adaptativo redireciona
// a sessão para sessionStorage (morre ao fechar o browser), ou para
// localStorage quando marcado (persiste entre sessões).
const adaptiveStorage = {
  getItem: (key: string) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    const remember = localStorage.getItem("pilar-remember-me") !== "false";
    if (remember) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // Toda falha de REST/RPC/Storage/Auth vai pro Sentry aqui, no único ponto por
  // onde todas passam, em vez de depender de captureException em cada tela.
  // Ver ADR 0030.
  global: { fetch: createInstrumentedFetch() },
  auth: {
    storage: adaptiveStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Evita deadlock cross-tab: navigator.locks é compartilhado por origem,
    // uma tab com _initialize() presa bloqueia todas as outras indefinidamente.
    // Com no-op lock cada tab inicializa independentemente.
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});
