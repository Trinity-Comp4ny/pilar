import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMonitoring, monitoring } from "./lib/monitoring";
import { initAnalytics } from "./lib/analytics";
import { initStaleChunkReload } from "./lib/staleChunkReload";
import { envWarnings } from "./lib/env";

initMonitoring();
initAnalytics();
initStaleChunkReload();

// Config ausente que degrada o produto sem impedir o boot (captcha, Sentry, analytics).
// Reportado depois do initMonitoring para chegar no Sentry: antes, um deploy sem
// VITE_TURNSTILE_SITE_KEY subia a tela de login sem captcha e ninguém ficava sabendo.
for (const aviso of envWarnings()) {
  monitoring.captureMessage(`[env] ${aviso}`, "warning");
}

// Redireciona recovery links para /reset-password antes do React montar,
// evitando race condition com onAuthStateChange.
if (window.location.hash.includes("type=recovery")) {
  window.history.replaceState(null, "", "/reset-password" + window.location.hash);
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha silenciosa — app continua funcionando sem SW
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
