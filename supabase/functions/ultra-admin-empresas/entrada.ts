type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Empresa nova criada pelo ultra admin: nome, CNPJ opcional e o dono a convidar. */
export function lerNovaEmpresa(corpo: unknown): Resultado<{
  nome: string;
  cnpj: string | null;
  ownerEmail: string;
  ownerNome: string | null;
}> {
  const b = obj(corpo);
  const nome = texto(b.nome).slice(0, 200);
  const cnpj = texto(b.cnpj) || null;
  const ownerEmail = texto(b.owner_email).toLowerCase();
  const ownerNome = texto(b.owner_nome).slice(0, 200) || null;

  if (!nome) return { ok: false, error: "Nome da empresa é obrigatório" };
  if (!ownerEmail || ownerEmail.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return { ok: false, error: "E-mail do dono inválido" };
  }
  return { ok: true, data: { nome, cnpj, ownerEmail, ownerNome } };
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
