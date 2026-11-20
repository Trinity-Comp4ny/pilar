// O Firebase publica o bundle pronto. Uma URL errada no build vira chamadas
// ao banco errado mesmo que o deploy de Hosting consiga publicar os arquivos.
const refs = {
  preview: "rizaklgstyfrwgmdsldf",
  live: "vepnsonbnsimqcsfcagm",
};

const env = process.env;
const canal = env.CANAL;
if (!Object.hasOwn(refs, canal)) throw new Error("Canal do Firebase inválido.");
if (canal === "live" && (env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REF !== "refs/heads/main")) {
  throw new Error("Hosting live exige um disparo manual a partir da main.");
}
for (const nome of ["FIREBASE_PROJECT", "SITE_ID", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!env[nome]?.trim()) throw new Error(`Variável ${nome} ausente no Environment.`);
}
const urlEsperada = `https://${refs[canal]}.supabase.co`;
if (env.VITE_SUPABASE_URL.replace(/\/$/, "") !== urlEsperada) {
  throw new Error(`VITE_SUPABASE_URL não corresponde ao projeto esperado para ${canal}.`);
}
console.log(`Ambiente Firebase validado para ${canal}.`);
