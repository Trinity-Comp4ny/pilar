// O Firebase publica o bundle pronto. Uma URL errada no build vira chamadas
// ao banco errado mesmo que o deploy de Hosting consiga publicar os arquivos.
const refs = {
  preview: "rizaklgstyfrwgmdsldf",
  staging: "rizaklgstyfrwgmdsldf",
  live: "vepnsonbnsimqcsfcagm",
};

const env = process.env;
const canal = env.CANAL;
if (!Object.hasOwn(refs, canal)) throw new Error("Canal do Firebase inválido.");
// Live só sai de main (disparo manual nela ou CI verde dela); staging, do CI verde de staging ou de
// disparo manual a partir de staging/main. Nenhuma outra origem publica em site fixo.
const evento = env.GITHUB_EVENT_NAME;
const manual = evento === "workflow_dispatch";
const permitido = {
  live:
    (manual && env.GITHUB_REF === "refs/heads/main") || (evento === "workflow_run" && env.CI_HEAD_BRANCH === "main"),
  staging:
    (manual && ["refs/heads/main", "refs/heads/staging"].includes(env.GITHUB_REF)) ||
    (evento === "push" && env.GITHUB_REF === "refs/heads/staging"),
  preview: true,
};
if (!permitido[canal]) {
  throw new Error(`Hosting ${canal} não pode ser publicado por este evento ou branch.`);
}
for (const nome of ["FIREBASE_PROJECT", "SITE_ID", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!env[nome]?.trim()) throw new Error(`Variável ${nome} ausente no Environment.`);
}
const urlEsperada = `https://${refs[canal]}.supabase.co`;
if (env.VITE_SUPABASE_URL.replace(/\/$/, "") !== urlEsperada) {
  throw new Error(`VITE_SUPABASE_URL não corresponde ao projeto esperado para ${canal}.`);
}
console.log(`Ambiente Firebase validado para ${canal}.`);
