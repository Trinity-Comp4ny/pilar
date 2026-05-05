// Scenario: create receita (income) lancamento via Supabase REST API.
// Run: k6 run tests/load/scenarios/criar-receita.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { authenticate } from '../utils/auth.js';
import { config, defaultStages, defaultThresholds, supabaseHeaders } from '../utils/setup.js';

export const errors = new Counter('errors');

export const options = {
  stages: defaultStages,
  thresholds: defaultThresholds,
};

export function setup() {
  const session = authenticate();
  return { token: session.accessToken, userId: session.userId };
}

export default function (data) {
  const headers = {
    ...supabaseHeaders(data.token),
    Prefer: 'return=representation',
  };

  const payload = JSON.stringify({
    descricao: `LoadTest Receita VU${__VU} iter${__ITER}`,
    valor: Math.round(Math.random() * 10000) / 100,
    tipo: 'receita',
    data: new Date().toISOString().slice(0, 10),
    status: 'pendente',
  });

  const res = http.post(`${config.SUPABASE_URL}/rest/v1/lancamentos`, payload, {
    headers,
    tags: { name: 'criar_receita' },
  });

  const ok = check(res, {
    'status 201': (r) => r.status === 201,
    'returned id': (r) => {
      try {
        const arr = r.json();
        return Array.isArray(arr) && arr[0] && arr[0].id;
      } catch (_e) {
        return false;
      }
    },
  });

  if (!ok) errors.add(1);

  sleep(1);
}

export function teardown(data) {
  // Best-effort cleanup: delete rows tagged by this test run.
  const headers = supabaseHeaders(data.token);
  http.del(
    `${config.SUPABASE_URL}/rest/v1/lancamentos?descricao=like.LoadTest%20Receita%25`,
    null,
    { headers, tags: { name: 'cleanup_receitas' } },
  );
}
