import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { initAnalytics } from "./analytics";
import { registrarOrigem } from "./lib/origem";
import { guardarConteudoPronto } from "./lib/htmlPronto";
import "./index.css";

registrarOrigem();

// Analytics fora do caminho crítico: só inicia quando o navegador ficar ocioso
// (ou em 2s, no máximo), para não somar às tarefas longas da hidratação (TBT).
const quandoOcioso: (cb: () => void) => void =
  "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => window.setTimeout(cb, 1);
quandoOcioso(initAnalytics);

const root = document.getElementById("root")!;
guardarConteudoPronto(root, window.location.pathname);

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
