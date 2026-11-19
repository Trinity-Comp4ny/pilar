// SPEC 169: o rótulo de falante do Granola não é confiável (todas as falas como "Me", aviso
// da videochamada como nome). Aqui só se separa o que é texto de interface e se marca
// `incerto`; quem decide o papel de verdade é a evidência dentro do texto.

export type Falante = "provavel_cliente" | "provavel_fundador" | "incerto";

const TEXTO_DE_INTERFACE = [
  /^this meeting is being recorded/i,
  /^recording (in progress|started)/i,
  /^esta reuni[ãa]o est[áa] sendo gravada/i,
  /^gravando$/i,
  /^(waiting|aguardando)\b/i,
];

export function ehTextoDeInterface(rotulo: string): boolean {
  const r = rotulo.trim();
  return r.length === 0 || TEXTO_DE_INTERFACE.some((re) => re.test(r));
}

/** Rótulos "Me" / "Them" / nome genérico não provam quem falou: ficam incertos. */
export function classificarFalante(
  rotulo: string,
  nomesFundador: string[] = [],
  nomesCliente: string[] = [],
): Falante {
  if (ehTextoDeInterface(rotulo)) return "incerto";
  const r = rotulo.trim().toLowerCase();
  if (["me", "them", "eu", "speaker", "desconhecido"].includes(r)) return "incerto";
  if (nomesFundador.some((n) => r === n.toLowerCase())) return "provavel_fundador";
  if (nomesCliente.some((n) => r === n.toLowerCase())) return "provavel_cliente";
  return "incerto";
}
