import { cn } from "@/lib/utils";

interface AvatarStackProps {
  names: string[];
  max?: number;
  size?: "xs" | "sm";
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function AvatarStack({ names, max = 3, size = "sm", className }: AvatarStackProps) {
  const unique = Array.from(new Set(names)).filter(Boolean);
  if (unique.length === 0) return null;

  const visible = unique.slice(0, max);
  const overflow = unique.length - visible.length;
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {visible.map((n) => (
        <span
          key={n}
          title={n}
          className={cn(
            "rounded-full ring-2 ring-white flex items-center justify-center font-semibold",
            dim,
            colorFor(n)
          )}
        >
          {initials(n)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "rounded-full ring-2 ring-white bg-muted text-muted-foreground flex items-center justify-center font-semibold",
            dim
          )}
          title={unique.slice(max).join(", ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
