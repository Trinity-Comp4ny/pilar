// Quiz #1: o que mais tira lucro.
import { quizVideo } from "./quiz-base.js";

quizVideo({
  pergunta: "O que mais tira lucro de um escritório de projeto?",
  opcoes: [["A", "O software que vocês usam", false], ["B", "Revisão do cliente feita sem aditivo", true], ["C", "O café da equipe", false]],
  explicacao: "Revisão fora do escopo, sem aditivo, é hora que <b>ninguém paga</b>. O café pode ficar.",
});
