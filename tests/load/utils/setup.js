// k6 setup utilities for Pilar load tests.
// Reads configuration from environment variables. Never hardcode credentials.

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:8080';
const SUPABASE_URL = __ENV.K6_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = __ENV.K6_SUPABASE_KEY || '';
const TEST_EMAIL = __ENV.K6_TEST_EMAIL || 'loadtest@pilar.local';
const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD || 'changeme';

if (!SUPABASE_KEY) {
  // k6 will surface this in setup() phase; do not crash the module load.
  console.warn('[k6] K6_SUPABASE_KEY is empty — requests will be unauthorized.');
}

export const config = {
  BASE_URL,
  SUPABASE_URL,
  SUPABASE_KEY,
  TEST_EMAIL,
  TEST_PASSWORD,
};

export const defaultThresholds = {
  http_req_duration: ['p(95)<500'],
  http_req_failed: ['rate<0.01'],
  errors: ['count<10'],
};

// K6_PERFIL=semanal: carga leve e curta do workflow agendado (carga-semanal.yml),
// contra o staging compartilhado. Mede regressão de latência, não capacidade.
// Sem o perfil: a rampa completa até 100 VUs, para rodar à mão antes de release.
const STAGES_COMPLETO = [
  { duration: '1m', target: 10 },
  { duration: '2m', target: 50 },
  { duration: '2m', target: 100 },
  { duration: '5m', target: 100 },
  { duration: '2m', target: 0 },
];
const STAGES_SEMANAL = [
  { duration: '1m', target: 5 },
  { duration: '3m', target: 10 },
  { duration: '1m', target: 0 },
];

export const defaultStages = __ENV.K6_PERFIL === 'semanal' ? STAGES_SEMANAL : STAGES_COMPLETO;

export function supabaseHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
  };
}
