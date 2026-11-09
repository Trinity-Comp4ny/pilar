/**
 * Erro de template Word com mensagem pronta para o usuário (o que houve e o que fazer).
 * Arquivo próprio e sem dependências: a tela pode checar `instanceof` sem puxar o
 * docxtemplater/pizzip, que só carregam sob demanda (docxUtils).
 */
export class ErroDeDocx extends Error {
  /** Erro original do docxtemplater/pizzip, para telemetria. */
  readonly causa?: unknown;

  constructor(message: string, causa?: unknown) {
    super(message);
    this.name = "ErroDeDocx";
    this.causa = causa;
  }
}
