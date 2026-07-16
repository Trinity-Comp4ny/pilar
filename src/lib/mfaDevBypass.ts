/**
 * MFA desligado SÓ no dev local apontando pro Supabase local.
 *
 * Nunca afeta staging/prod: o build de produção tem `import.meta.env.DEV=false`,
 * e o bypass só ativa quando `VITE_SUPABASE_URL` é 127.0.0.1/localhost (ou seja,
 * você está olhando pro banco local). Serve para não ter que enrolar/digitar 2FA
 * a cada login no desenvolvimento local.
 */
export function mfaDevBypass(): boolean {
  return (
    import.meta.env.DEV &&
    /(?:127\.0\.0\.1|localhost)/.test(import.meta.env.VITE_SUPABASE_URL ?? "")
  );
}
