/**
 * Catálogo dos avisos legais por e-mail aos administradores das contas. Puro (sem Deno):
 * conteúdo fixo por aviso, revisado no PR, para o painel nunca mandar texto livre em
 * nome do Pilar. Aviso novo (reajuste, fornecedor novo) entra aqui com id próprio; o id
 * faz parte da chave de idempotência, então reenviar o mesmo aviso não duplica.
 */

export interface AvisoLegal {
  id: string;
  /** Nome no painel do ultra admin. */
  nome: string;
  assunto: string;
  titulo: string;
  lead: string;
  itens: string[];
  vigencia: string;
  /** Caminho no site público (www). */
  caminho: string;
  linkLabel: string;
  rodape: string;
}

export const AVISOS_LEGAIS: Record<string, AvisoLegal> = {
  "termos-2.0": {
    id: "termos-2.0",
    nome: "Termos de Uso 2.0 e Política de Privacidade 2.1",
    assunto: "Os Termos de Uso do Pilar mudam em 10 de dezembro",
    titulo: "Novos Termos de Uso do Pilar",
    lead: "Atualizamos os Termos de Uso e a Política de Privacidade. As mudanças valem para a sua conta a partir de 10 de dezembro de 2026. O que muda:",
    itens: [
      "Agentes de IA: a IA prepara e a sua equipe revisa e aprova. O Pilar não substitui a responsabilidade técnica (ART e RRT) do escritório.",
      "Créditos de IA: a cota do plano renova a cada ciclo; créditos comprados à parte não expiram e podem ser desfeitos em até 7 dias se não forem usados.",
      "Proteção de dados: o Anexo de Tratamento de Dados Pessoais passa a fazer parte dos Termos, com a lista de fornecedores e o aviso de 30 dias antes de incluir um novo.",
      "Responsabilidade: limite igual ao valor pago nos 12 meses anteriores, sem limitar dolo, culpa grave ou vazamento de dados por falha do Pilar.",
      "Preço: reajuste avisado com 30 dias, com direito de cancelar sem multa. Foro: o do domicílio do seu escritório.",
      "Privacidade: a política agora lista todos os fornecedores, onde cada um processa os dados, os prazos de guarda e os registros de acesso exigidos pelo Marco Civil.",
    ],
    vigencia: "10 de dezembro de 2026",
    caminho: "/termos",
    linkLabel: "Ler os Termos de Uso",
    rodape: "Os Termos de Uso preveem este aviso com 30 dias de antecedência.",
  },
};

export interface Administrador {
  id: string;
  email: string | null;
  first_name: string | null;
  role: string | null;
  desativado_em: string | null;
}

/** Quem recebe: admin ativo, com e-mail real (a exclusão LGPD troca o e-mail por um .invalid). */
export function destinatarios(perfis: Administrador[]): Array<Administrador & { email: string }> {
  return perfis.filter(
    (p): p is Administrador & { email: string } =>
      p.role === "admin" && !p.desativado_em && !!p.email && !p.email.trim().toLowerCase().endsWith(".invalid")
  );
}

export function chaveIdempotencia(avisoId: string, userId: string): string {
  return `aviso-legal-${avisoId}-${userId}`;
}

export type Entrada = { ok: true; aviso: AvisoLegal; enviar: boolean } | { ok: false; error: string };

export function lerEntrada(corpo: unknown): Entrada {
  if (!corpo || typeof corpo !== "object") return { ok: false, error: "Corpo inválido" };
  const { aviso, modo } = corpo as { aviso?: unknown; modo?: unknown };
  if (typeof aviso !== "string" || !AVISOS_LEGAIS[aviso]) return { ok: false, error: "Aviso desconhecido" };
  if (modo !== "simular" && modo !== "enviar") return { ok: false, error: "Modo deve ser simular ou enviar" };
  return { ok: true, aviso: AVISOS_LEGAIS[aviso], enviar: modo === "enviar" };
}
