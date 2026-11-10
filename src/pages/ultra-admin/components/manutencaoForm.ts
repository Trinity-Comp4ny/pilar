// Formulário de manutenção programada (SPEC 153): conversão e validação, fora do componente.
export interface FormManutencao {
  titulo: string;
  mensagem: string;
  inicio: string;
  fim: string;
}

export const VAZIO: FormManutencao = { titulo: "", mensagem: "", inicio: "", fim: "" };

/** Valor de `<input type="datetime-local">` (hora do navegador) para ISO. Vazio ou inválido = null. */
export function localParaIso(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function erroDoForm(form: FormManutencao, agora = Date.now()): string | null {
  if (!form.titulo.trim()) return "Dê um título à manutenção.";
  const inicio = localParaIso(form.inicio);
  const fim = localParaIso(form.fim);
  if (!inicio || !fim) return "Informe início e fim.";
  if (new Date(fim) <= new Date(inicio)) return "O fim precisa ser depois do início.";
  if (new Date(fim).getTime() <= agora) return "Essa janela já passou.";
  return null;
}
