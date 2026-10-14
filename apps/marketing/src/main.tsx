import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { initAnalytics } from "./analytics";
import { registrarOrigem } from "./lib/origem";
import { guardarConteudoPronto } from "./lib/htmlPronto";
import "./index.css";

initAnalytics();
registrarOrigem();

const root = document.getElementById("root")!;
guardarConteudoPronto(root, window.location.pathname);

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
