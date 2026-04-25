import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMonitoring } from "./lib/monitoring";

initMonitoring();

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
