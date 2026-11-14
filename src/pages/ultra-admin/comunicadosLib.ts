// Regras da tela de comunicados (SPEC 157): validação, público e situação.
import { localParaIso } from "./components/manutencaoForm";

export interface FormComunicado {
  titulo: string;
  mensagem: string;
  formato: "faixa" | "modal";
  linkUrl: string;
  linkRotulo: string;
  empresaId: string | null;
  planoSlug: string | null;
  soAdmins: boolean;
  inicio: string;
  fim: string;
}

export function erroDoComunicado(f: FormComunicado): string | null {
  if (!f.titulo.trim()) return "Dê um título.";
  if (!f.mensagem.trim()) return "Escreva a mensagem.";
  const link = f.linkUrl.trim();
  if (link && !link.startsWith("/") && !link.startsWith("https://")) return "O link começa com / ou https://.";
  const inicio = f.inicio ? localParaIso(f.inicio) : new Date().toISOString();
  const fim = f.fim ? localParaIso(f.fim) : null;
  if (f.inicio && !inicio) return "Início inválido.";
  if (f.fim && !fim) return "Fim inválido.";
  if (inicio && fim && new Date(fim) <= new Date(inicio)) return "O fim precisa ser depois do início.";
  return null;
}

export function publicoDoComunicado(
  c: { plano_slug: string | null; so_admins: boolean },
  empresa: string | null
): string {
  const partes = [empresa ?? "Todos os escritórios"];
  if (c.plano_slug) partes.push(`plano ${c.plano_slug}`);
  if (c.so_admins) partes.push("só administradores");
  return partes.join(", ");
}

export function situacaoComunicado(
  c: { inicio: string; fim: string | null; encerrado_em: string | null },
  agora: number
): "ativo" | "programado" | "encerrado" {
  if (c.encerrado_em) return "encerrado";
  if (c.fim && new Date(c.fim).getTime() <= agora) return "encerrado";
  if (new Date(c.inicio).getTime() > agora) return "programado";
  return "ativo";
}
