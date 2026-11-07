// Perfil do escritório e da pessoa (SPEC 149): as listas fechadas que o
// onboarding, as Configurações e o ultra-admin usam. Os valores batem com os
// CHECK da migration 20261203000000; mudar aqui exige mudar lá.

export type Opcao<T extends string> = { value: T; label: string };

export const PORTES = [
  { value: "1-5", label: "1 a 5 pessoas" },
  { value: "6-15", label: "6 a 15" },
  { value: "16-40", label: "16 a 40" },
  { value: "40+", label: "Mais de 40" },
] as const satisfies readonly Opcao<string>[];

export const DISCIPLINAS = [
  { value: "arquitetura", label: "Arquitetura" },
  { value: "estrutural", label: "Estrutural" },
  { value: "instalacoes", label: "Instalações (MEP)" },
  { value: "civil_infra", label: "Civil e infraestrutura" },
  { value: "geotecnia", label: "Geotecnia" },
  { value: "outra", label: "Outra" },
] as const satisfies readonly Opcao<string>[];

export const FUNCOES = [
  { value: "socio", label: "Sócio ou diretor" },
  { value: "coordenador", label: "Coordenação de projetos" },
  { value: "tecnico", label: "Engenharia, arquitetura ou projeto" },
  { value: "financeiro", label: "Financeiro ou administrativo" },
  { value: "outra", label: "Outra" },
] as const satisfies readonly Opcao<string>[];

/** Canal de aquisição: resposta "como conheceu" do dono e origem anotada pelo ultra-admin. */
export const CANAIS = [
  { value: "indicacao", label: "Indicação" },
  { value: "google", label: "Google" },
  { value: "ia", label: "ChatGPT ou outra IA" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
] as const satisfies readonly Opcao<string>[];

/** Pilar por onde o escritório quer começar. Os três pesam igual. */
export const OBJETIVOS = [
  {
    value: "gestao",
    label: "Gestão",
    descricao: "Clientes, propostas e o financeiro do escritório.",
  },
  {
    value: "projetos",
    label: "Projetos",
    descricao: "Escopo, fases, disciplinas e prazos de cada projeto.",
  },
  {
    value: "obras",
    label: "Obras",
    descricao: "Acompanhamento, diário, compras e fornecedores da obra.",
  },
] as const;
export type Objetivo = (typeof OBJETIVOS)[number]["value"];

export function rotuloDe<T extends string>(
  lista: readonly Opcao<T>[],
  valor: string | null | undefined
): string | null {
  if (!valor) return null;
  return lista.find((o) => o.value === valor)?.label ?? null;
}

export function ehObjetivo(v: unknown): v is Objetivo {
  return OBJETIVOS.some((o) => o.value === v);
}

// Provedores de e-mail pessoal: domínio deles não é o site do escritório.
const DOMINIOS_PUBLICOS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "proton.me",
  "protonmail.com",
]);

/** Site sugerido a partir do e-mail corporativo; null para e-mail pessoal. */
export function sugerirSite(email: string | null | undefined): string | null {
  const dominio = email?.split("@")[1]?.trim().toLowerCase();
  if (!dominio || !dominio.includes(".") || DOMINIOS_PUBLICOS.has(dominio)) return null;
  return dominio;
}

/** Normaliza o site digitado: tira protocolo, "www." e barra final. Vazio vira null. */
export function normalizarSite(valor: string): string | null {
  const limpo = valor
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return limpo ? limpo.slice(0, 200) : null;
}

export type LinkedinNormalizado = { ok: true; url: string | null } | { ok: false };

/**
 * Aceita a URL completa, sem protocolo ou só o usuário ("joao-silva") e
 * devolve https://www.linkedin.com/in/... Vazio é válido (campo opcional).
 */
export function normalizarLinkedin(valor: string): LinkedinNormalizado {
  const v = valor.trim();
  if (!v) return { ok: true, url: null };
  if (/^[a-z0-9-]{3,100}$/i.test(v)) return { ok: true, url: `https://www.linkedin.com/in/${v}` };
  const semProtocolo = v.replace(/^https?:\/\//i, "");
  if (!/^([a-z]{2,3}\.)?linkedin\.com\/\S+$/i.test(semProtocolo) || semProtocolo.length > 290) return { ok: false };
  return { ok: true, url: `https://${semProtocolo.replace(/\/+$/, "")}` };
}
