// Manifesto #2: revisão não é favor.
import { manifestoVideo } from "./manifesto-base.js";

manifestoVideo({
  frases: [
    { words: ["Revisão", "não é", "favor."], bg: "#F7F7F7", fg: "#1A1A1A", accent: "favor.", size: 220 },
    { words: ["Aditivo", "não é", "vergonha."], bg: "#0C0E0C", fg: "#FFFFFF", accent: "vergonha.", size: 190 },
    { words: ["Prazo", "não é", "chute."], bg: "#A4EC86", fg: "#1A1A1A", accent: "chute.", size: 230 },
  ],
  virada: "É combinado.",
  viradaDestaque: "É *gestão*.",
});
