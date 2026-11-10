// Quiz #2: o registro antes de começar.
import { quizVideo } from "./quiz-base.js";

quizVideo({
  pergunta: "O que precisa estar registrado antes de começar um projeto?",
  opcoes: [["A", "O logo do escritório no carimbo", false], ["B", "A ART ou o RRT do responsável", true], ["C", "O grupo da obra criado", false]],
  explicacao: "ART no <b>CREA</b> para engenharia, RRT no <b>CAU</b> para arquitetura. O grupo pode esperar.",
  bg: "linear-gradient(165deg, #DCEBFA 0%, #B9D6F2 60%, #9CC3EA 100%)",
});
