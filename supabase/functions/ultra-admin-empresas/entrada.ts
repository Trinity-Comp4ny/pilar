type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Listas fechadas do perfil do escritório (SPEC 149). Batem com os CHECK da
// migration 20261202000000 e com src/lib/perfilEscritorio.ts.
const PORTES = ["1-5", "6-15", "16-40", "40+"];
const DISCIPLINAS = ["arquitetura", "estrutural", "instalacoes", "civil_infra", "geotecnia", "outra"];
const CANAIS = ["indicacao", "google", "ia", "linkedin", "instagram", "youtube", "evento", "outro"];

/** Site sem protocolo, "www." nem barra final; vazio vira null. */
function lerSite(v: unknown): string | null {
  const s = texto(v)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return s ? s.slice(0, 200) : null;
}

/**
 * Empresa nova criada pelo ultra admin: nome, o dono a convidar e o que já se
 * sabe do escritório pela demonstração (CNPJ, site, porte, disciplinas, origem).
 * Tudo do perfil é opcional; valor fora da lista vira erro, não é descartado.
 */
export function lerNovaEmpresa(corpo: unknown): Resultado<{
  nome: string;
  cnpj: string | null;
  ownerEmail: string;
  ownerNome: string | null;
  site: string | null;
  porte: string | null;
  disciplinas: string[] | null;
  origem: string | null;
}> {
  const b = obj(corpo);
  const nome = texto(b.nome).slice(0, 200);
  const cnpj = texto(b.cnpj) || null;
  const ownerEmail = texto(b.owner_email).toLowerCase();
  const ownerNome = texto(b.owner_nome).slice(0, 200) || null;
  const site = lerSite(b.site);
  const porte = texto(b.porte) || null;
  const origem = texto(b.origem) || null;
  const disciplinasBrutas = Array.isArray(b.disciplinas) ? b.disciplinas.map(texto).filter(Boolean) : [];
  const disciplinas = disciplinasBrutas.length > 0 ? [...new Set(disciplinasBrutas)] : null;

  if (!nome) return { ok: false, error: "Nome da empresa é obrigatório" };
  if (!ownerEmail || ownerEmail.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return { ok: false, error: "E-mail do dono inválido" };
  }
  if (porte && !PORTES.includes(porte)) return { ok: false, error: "Porte inválido" };
  if (origem && !CANAIS.includes(origem)) return { ok: false, error: "Origem inválida" };
  if (disciplinas?.some((d) => !DISCIPLINAS.includes(d))) return { ok: false, error: "Disciplina inválida" };
  return { ok: true, data: { nome, cnpj, ownerEmail, ownerNome, site, porte, disciplinas, origem } };
}

/** Liga/desliga uma feature em massa (spec 035): em todas, ou só nas que têm o módulo pai. */
export function lerAcaoEmMassa(corpo: unknown): Resultado<{
  feature: string;
  value: boolean;
  scope: "all" | "has_parent";
  parent: string | null;
}> {
  const b = obj(corpo);
  const feature = texto(b.feature);
  const parent = texto(b.parent) || null;

  if (!/^[a-z][a-z_]{0,63}$/.test(feature)) return { ok: false, error: "feature inválida" };
  if (typeof b.value !== "boolean") return { ok: false, error: "value deve ser boolean" };
  if (b.scope !== "all" && b.scope !== "has_parent") return { ok: false, error: "scope inválido" };
  if (b.scope === "has_parent" && !parent) {
    return { ok: false, error: "parent é obrigatório para scope has_parent" };
  }
  return { ok: true, data: { feature, value: b.value, scope: b.scope, parent } };
}

/**
 * Exclusão definitiva de empresa (SPEC 117): nome digitado igual ao cadastrado
 * e motivo obrigatório (vai pro log). A conferência do nome é feita no index,
 * que é quem conhece o nome atual.
 */
export function lerExclusaoEmpresa(corpo: unknown): Resultado<{
  empresaId: string;
  confirmName: string;
  motivo: string;
}> {
  const b = obj(corpo);
  const empresaId = texto(b.empresa_id);
  const confirmName = texto(b.confirm_name);
  const motivo = texto(b.motivo).slice(0, 500);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId)) {
    return { ok: false, error: "empresa_id inválido" };
  }
  if (!confirmName) return { ok: false, error: "Digite o nome da empresa para confirmar" };
  if (!motivo) return { ok: false, error: "Motivo é obrigatório" };
  return { ok: true, data: { empresaId, confirmName, motivo } };
}
