/** Todo template devolve assunto + HTML. O texto puro é gerado pelo client. */
export interface EmailTemplate {
  subject: string;
  html: string;
}

/** Dados do escritório para e-mail de classe "escritorio" (header co-branded). */
export interface EmpresaHeader {
  nome: string;
  logoUrl?: string | null;
}
