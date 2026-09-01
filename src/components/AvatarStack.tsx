import { useState } from "react";
import { cn } from "@/lib/utils";

export type PessoaAvatar = string | { nome: string; avatarUrl?: string | null };

interface AvatarStackProps {
  pessoas: PessoaAvatar[];
  max?: number;
  size?: "xs" | "sm" | "lg";
  className?: string;
}

const COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-positive/10 text-positive-strong",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
];

function normaliza(p: PessoaAvatar): { nome: string; avatarUrl?: string | null } {
  return typeof p === "string" ? { nome: p } : p;
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash + nome.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

/** Um círculo: foto quando existe e carrega, iniciais coloridas como fallback (padrão Slack). */
function AvatarCirculo({ nome, avatarUrl, dim }: { nome: string; avatarUrl?: string | null; dim: string }) {
  const [falhouAoCarregar, setFalhouAoCarregar] = useState(false);

  if (avatarUrl && !falhouAoCarregar) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        title={nome}
        className={cn("rounded-full ring-2 ring-white object-cover", dim)}
        onError={() => setFalhouAoCarregar(true)}
      />
    );
  }

  return (
    <span
      title={nome}
      className={cn(
        "rounded-full ring-2 ring-white flex items-center justify-center font-semibold",
        dim,
        colorFor(nome)
      )}
    >
      {initials(nome)}
    </span>
  );
}

export function AvatarStack({ pessoas, max = 3, size = "sm", className }: AvatarStackProps) {
  const normalizadas = pessoas.map(normaliza).filter((p) => p.nome);
  const unique = Array.from(new Map(normalizadas.map((p) => [p.nome, p])).values());
  if (unique.length === 0) return null;

  const visible = unique.slice(0, max);
  const overflow = unique.length - visible.length;
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : size === "lg" ? "h-16 w-16 text-lg" : "h-6 w-6 text-[10px]";

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {visible.map((p) => (
        <AvatarCirculo key={p.nome} nome={p.nome} avatarUrl={p.avatarUrl} dim={dim} />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "rounded-full ring-2 ring-white bg-muted text-muted-foreground flex items-center justify-center font-semibold",
            dim
          )}
          title={unique
            .slice(max)
            .map((p) => p.nome)
            .join(", ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
