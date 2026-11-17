import { z } from "zod";

export const PROPOSTA_PDF_MAX_BYTES = 15 * 1024 * 1024;
export const propostaPdfSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título da proposta.").max(200),
  valor: z.number().finite().nonnegative("O valor não pode ser negativo."),
  condicoes: z.string().max(10000, "Use até 10.000 caracteres nas condições."),
  motivo: z.string().max(2000, "Use até 2.000 caracteres no motivo."),
});

export async function validarPropostaPdf(arquivo: File | null): Promise<string | null> {
  if (!arquivo) return "Selecione o PDF da proposta.";
  if (!/\.pdf$/i.test(arquivo.name)) return "Selecione um arquivo PDF.";
  if (!arquivo.size || arquivo.size > PROPOSTA_PDF_MAX_BYTES) return "O PDF deve ter até 15 MB e não pode estar vazio.";
  if (arquivo.name.length > 200) return "Use um nome de arquivo com até 200 caracteres.";
  const assinatura = new TextDecoder().decode(await arquivo.slice(0, 5).arrayBuffer());
  return assinatura === "%PDF-" ? null : "O arquivo não contém um PDF válido.";
}
