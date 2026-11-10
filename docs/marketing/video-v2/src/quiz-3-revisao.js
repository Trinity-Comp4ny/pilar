// Quiz #3: o cliente pediu uma revisão fora do escopo.
import { quizVideo } from "./quiz-base.js";

quizVideo({
  tag: "E você, faria o quê?",
  pergunta: "O cliente pediu uma revisão fora do escopo. O primeiro passo é:",
  opcoes: [["A", "Fazer logo e cobrar depois", false], ["B", "Registrar o pedido e estimar as horas", true], ["C", "Fazer de graça para agradar", false]],
  explicacao: "Pedido registrado e hora estimada viram <b>aditivo com base</b>. Depois de feito, vira briga.",
  bg: "linear-gradient(165deg, #FBE7CF 0%, #F7D3A8 60%, #F0BE84 100%)",
});
