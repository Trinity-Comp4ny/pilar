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

export const defaultStages = [
  { duration: '1m', target: 10 },
  { duration: '2m', target: 50 },
  { duration: '2m', target: 100 },
  { duration: '5m', target: 100 },
  { duration: '2m', target: 0 },
];

export function supabaseHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
  };
}
