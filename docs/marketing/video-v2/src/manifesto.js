// Manifesto #1: engenharia não é planilha.
import { manifestoVideo } from "./manifesto-base.js";

manifestoVideo({
  frases: [
    { words: ["Engenharia", "não é", "planilha."], bg: "#0C0E0C", fg: "#FFFFFF", accent: "planilha.", size: 190 },
    { words: ["Projeto", "não é", "WhatsApp."], bg: "#A4EC86", fg: "#1A1A1A", accent: "WhatsApp.", size: 190 },
    { words: ["Lucro", "não é", "sorte."], bg: "#F7F7F7", fg: "#1A1A1A", accent: "sorte.", size: 230 },
  ],
  virada: "É método.",
  viradaDestaque: "É *sistema*.",
});
