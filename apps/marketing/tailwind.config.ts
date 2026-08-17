import type { Config } from "tailwindcss";
// Reaproveita o tema (cores/tokens/keyframes) do app raiz — fonte única de
// verdade (ADR 0008 + 0021). Só o `content` muda, pra apontar pra este workspace.
import rootConfig from "../../tailwind.config";

export default {
  ...rootConfig,
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
