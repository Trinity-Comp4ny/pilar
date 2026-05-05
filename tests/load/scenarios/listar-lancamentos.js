// Scenario: list lancamentos with filters + pagination. Stress RLS + indexes.
// Run: k6 run tests/load/scenarios/listar-lancamentos.js

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
  return { token: session.accessToken };
}

export default function (data) {
  const headers = supabaseHeaders(data.token);

  // Random pagination + filtros típicos da UI
  const page = Math.floor(Math.random() * 10);
  const pageSize = 25;
  const offset = page * pageSize;
  const tipo = Math.random() > 0.5 ? 'receita' : 'despesa';

  const url =
    `${config.SUPABASE_URL}/rest/v1/lancamentos` +
    `?select=id,descricao,valor,tipo,data,status` +
    `&tipo=eq.${tipo}` +
    `&order=data.desc` +
    `&limit=${pageSize}` +
    `&offset=${offset}`;

  const res = http.get(url, {
    headers: { ...headers, Prefer: 'count=exact' },
    tags: { name: 'listar_lancamentos' },
  });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'returned array': (r) => {
      try {
        return Array.isArray(r.json());
      } catch (_e) {
        return false;
      }
    },
    'has content-range': (r) => Boolean(r.headers['Content-Range']),
  });

  if (!ok) errors.add(1);

  sleep(0.5);
}
