import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { initAnalytics } from "./analytics";
import { registrarOrigem } from "./lib/origem";
import "./index.css";

initAnalytics();
registrarOrigem();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
