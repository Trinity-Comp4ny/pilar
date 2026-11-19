import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { redigir } from "./redacao.ts";
import { classificarFalante, ehTextoDeInterface } from "./falantes.ts";
import { aplicarGlossario } from "./glossario.ts";
import { aterrar, citacaoExiste } from "./aterrar.ts";

// Fixtures sintéticas: o repositório é público, transcript real nunca entra aqui.

Deno.test("redigir: e-mail, telefone, CPF, CNPJ e valor viram marca e só a contagem fica", () => {
  const r = redigir(
    "Manda para fulano@exemplo.com.br ou ligue (11) 91234-5678. CPF 123.456.789-09, CNPJ 12.345.678/0001-95. Fechamos por R$ 12.500,00."
  );
  assert(!r.texto.includes("fulano@"));
  assert(!r.texto.includes("91234"));
  assert(!r.texto.includes("123.456.789"));
  assert(!r.texto.includes("12.500"));
  assertEquals(r.contagem.email, 1);
  assertEquals(r.contagem.telefone, 1);
  assertEquals(r.contagem.cpf, 1);
  assertEquals(r.contagem.cnpj, 1);
  assertEquals(r.contagem.valor, 1);
});

Deno.test("redigir: URL com token e senha ditada somem", () => {
  const r = redigir("Abre https://app.exemplo.com/x?token=abc123 e a senha é a b c 1 2 3 ok");
  assert(!r.texto.includes("abc123"));
  assert(r.texto.includes("[SENHA]"));
  assertEquals(r.contagem.url_token, 1);
  assertEquals(r.contagem.senha, 1);
});

Deno.test("redigir: texto sem dado sensível passa intacto", () => {
  const t = "O cronograma do projeto estrutural atrasou duas semanas.";
  const r = redigir(t);
  assertEquals(r.texto, t);
  assertEquals(r.contagem, {});
});

Deno.test("falantes: aviso da videochamada é texto de interface e 'Me' fica incerto", () => {
  assert(ehTextoDeInterface("This meeting is being recorded"));
  assertEquals(classificarFalante("Me"), "incerto");
  assertEquals(classificarFalante("Them"), "incerto");
});

Deno.test("falantes: nome conhecido vira provável, desconhecido fica incerto", () => {
  assertEquals(classificarFalante("Ana", ["Ana"], ["Beto"]), "provavel_fundador");
  assertEquals(classificarFalante("Beto", ["Ana"], ["Beto"]), "provavel_cliente");
  assertEquals(classificarFalante("Carla", ["Ana"], ["Beto"]), "incerto");
});

Deno.test("glossário: corrige termos do domínio e não toca palavra parecida", () => {
  assertEquals(aplicarGlossario("Uso o Kube e o Synapse"), "Uso o CUB e o SINAPI");
  assertEquals(aplicarGlossario("a Inha ajuda"), "a IA ajuda");
  assertEquals(aplicarGlossario("o cloud code resolve"), "o Claude Code resolve");
  assertEquals(aplicarGlossario("cubo de concreto"), "cubo de concreto");
});

Deno.test("aterrar: citação literal passa, inventada é descartada e a confiança cai", () => {
  const transcript = "A gente perde muito tempo conferindo medição no fim do mês, é a nossa maior dor.";
  const bom = { texto: "Medição manual", citacao: "perde muito tempo conferindo medição" };
  const falso = { texto: "Quer app mobile", citacao: "precisamos de um aplicativo no celular" };
  const r = aterrar(transcript, [bom, falso]);
  assertEquals(r.aceitos, [bom]);
  assertEquals(r.descartados, [falso]);
  assertEquals(r.confianca, 0.5);
});

Deno.test("aterrar: ignora caixa, acento e pontuação; citação curta demais não vale", () => {
  assert(citacaoExiste("Medição, no FIM do mês!", "medicao no fim do mes"));
  assert(!citacaoExiste("Medição no fim do mês", "mês"));
});

Deno.test("aterrar: lista vazia tem confiança 1", () => {
  assertEquals(aterrar("qualquer", []).confianca, 1);
});
