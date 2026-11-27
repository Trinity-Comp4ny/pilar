// Dado seed do ambiente mock (npm run dev:mock). Tudo fictício: repo público.
export const UID = "00000000-0000-0000-0000-000000000001";
export const EMPRESA = "00000000-0000-0000-0000-0000000000e1";

const ETAPAS = [
  ["Novo", "Novo"],
  ["Em contato", "Em contato"],
  ["Proposta", "Proposta"],
  ["Negociação", "Negociação"],
  ["Ganho", "Ganho"],
  ["Perdido", "Perdido"],
];
const ORIGENS = ["Indicação", "Site", "Instagram", "Evento"];
const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa"];

export const etapas = ETAPAS.map(([nome, bucket], i) => ({ id: `et${i}`, nome, ordem: i, cor: null, bucket }));

/** Gera `n` leads determinísticos (mesmo n, mesma tela). */
export function gerarLeads(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `l${i}`,
    nome: NOMES[i % NOMES.length],
    sobrenome: `Silva ${i}`,
    email: `lead${i}@seed.test`,
    contato: null,
    status: etapas[i % etapas.length].bucket,
    etapa_id: etapas[i % etapas.length].id,
    origem: ORIGENS[i % ORIGENS.length],
    empresa_lead: `Escritório Seed ${i}`,
    valor_estimado: 10000 + i * 500,
    responsavel_id: UID,
    previsao_fechamento: "2026-12-15",
    created_at: new Date(Date.UTC(2026, 10, 1) - i * 864e5).toISOString(),
    empresa_id: EMPRESA,
  }));
}

export const profile = {
  id: UID,
  empresa_id: EMPRESA,
  first_name: "Dev",
  last_name: "Seed",
  email: "dev@local.test",
  role: "admin",
  is_active: true,
  onboarding_completed: true,
  empresas: { id: EMPRESA, nome: "Escritório Seed", onboarding_completed: true },
};

export const session = {
  access_token: "mock.access.token",
  refresh_token: "mock-refresh",
  expires_at: 4102444800,
  expires_in: 86400,
  token_type: "bearer",
  user: {
    id: UID,
    aud: "authenticated",
    role: "authenticated",
    email: "dev@local.test",
    app_metadata: {},
    user_metadata: {},
  },
};

/** Tabelas com dado; qualquer outra responde vazio (200, []). */
export function tabelas(nLeads) {
  const leads = gerarLeads(nLeads);
  return {
    leads_safe: leads,
    leads,
    lead_etapas: etapas,
    profiles: [profile],
    pilar_subscriptions: [{ empresa_id: EMPRESA, status: "active", plano: "pro" }],
  };
}
