// Scenario: dashboard reads. Exercises RLS + cached aggregations.
// Run: k6 run tests/load/scenarios/dashboard-read.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
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

  group('dashboard reads', function () {
    // Lançamentos do mês
    const lanc = http.get(
      `${config.SUPABASE_URL}/rest/v1/lancamentos?select=id,valor,data,tipo&limit=50&order=data.desc`,
      { headers, tags: { name: 'dashboard_lancamentos' } },
    );
    if (!check(lanc, { 'lancamentos 200': (r) => r.status === 200 })) errors.add(1);

    // Projetos ativos
    const proj = http.get(
      `${config.SUPABASE_URL}/rest/v1/projetos?select=id,nome,status&status=eq.ativo&limit=20`,
      { headers, tags: { name: 'dashboard_projetos' } },
    );
    if (!check(proj, { 'projetos 200': (r) => r.status === 200 })) errors.add(1);

    // Contas
    const contas = http.get(`${config.SUPABASE_URL}/rest/v1/contas?select=id,nome,saldo`, {
      headers,
      tags: { name: 'dashboard_contas' },
    });
    if (!check(contas, { 'contas 200': (r) => r.status === 200 })) errors.add(1);
  });

  sleep(1);
}
