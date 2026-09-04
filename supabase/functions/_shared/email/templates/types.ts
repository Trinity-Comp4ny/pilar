/** Todo template devolve assunto + HTML. O texto puro é gerado pelo client. */
export interface EmailTemplate {
  subject: string;
  html: string;
}
