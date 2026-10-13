/**
 * Proveniência de um agent_run (SPEC 110): qual commit e qual versão do prompt geraram a
 * saída. Liga uma execução ruim à versão que a produziu e aos evals daquela versão.
 */

type LerEnv = (chave: string) => string | undefined;
const lerEnvDeno: LerEnv = (chave) => Deno.env.get(chave);

/** Commit do deploy das edge functions (RELEASE_SHA, setado pelo CI). Null no ambiente local. */
export function releaseAtual(lerEnv: LerEnv = lerEnvDeno): string | null {
  return lerEnv("RELEASE_SHA") || null;
}

/** 16 primeiros hex do SHA-256 do system prompt. */
export async function hashDoPrompt(systemPrompt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(systemPrompt));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proveniencia(
  systemPrompt: string,
  lerEnv: LerEnv = lerEnvDeno
): Promise<{ release: string | null; prompt_hash: string }> {
  return { release: releaseAtual(lerEnv), prompt_hash: await hashDoPrompt(systemPrompt) };
}
