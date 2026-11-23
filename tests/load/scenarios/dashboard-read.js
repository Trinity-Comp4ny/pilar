// Scenario: dashboard reads. Exercises RLS + cached aggregations.
// Run: k6 run tests/load/scenarios/dashboard-read.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { authenticate } from '../utils/auth.js';
import { config, defaultStages, defaultThresholds, summaryTrendStats, supabaseHeaders } from '../utils/setup.js';

export const errors = new Counter('errors');
const painelRpcDuration = new Trend('painel_rpc_duration', true);

export const options = {
  stages: defaultStages,
  summaryTrendStats,
  thresholds: {
    ...defaultThresholds,
    painel_rpc_duration: defaultThresholds.http_req_duration,
  },
};

function buscarPainel(headers) {
  return http.post(
    `${config.SUPABASE_URL}/rest/v1/rpc/get_painel_gestao`,
    '{}',
    { headers, tags: { name: 'dashboard_painel_gestao' } },
  );
}

function painelValido(res) {
  if (res.status !== 200) return false;
  try {
    const dados = res.json();
    return dados !== null && typeof dados === 'object' && dados.gestao !== undefined;
  } catch {
    return false;
  }
}

export function setup() {
  const { accessToken: token } = authenticate();
  const painel = buscarPainel(supabaseHeaders(token));
  if (!painelValido(painel)) throw new Error(`Preflight do painel falhou: HTTP ${painel.status}.`);
  return { token };
}

export default function (data) {
  const headers = supabaseHeaders(data.token);

  group('dashboard reads', function () {
    // Lançamentos do mês
    const lanc = http.get(
      `${config.SUPABASE_URL}/rest/v1/lancamentos?select=id,valor,data_vencimento,tipo&limit=50&order=data_vencimento.desc`,
      { headers, tags: { name: 'dashboard_lancamentos' } },
    );
    if (!check(lanc, { 'lancamentos 200': (r) => r.status === 200 })) errors.add(1);

    // RPC realmente chamada pelo /inicio: mede a agregação em vez de uma
    // listagem de projetos filtrada por status "ativo" (valor inexistente).
    const painel = buscarPainel(headers);
    painelRpcDuration.add(painel.timings.duration);
    if (!check(painel, { 'painel 200 e payload de gestão': painelValido })) errors.add(1);

    // Contas
    const contas = http.get(`${config.SUPABASE_URL}/rest/v1/contas?select=id,nome,saldo_atual`, {
      headers,
      tags: { name: 'dashboard_contas' },
    });
    if (!check(contas, { 'contas 200': (r) => r.status === 200 })) errors.add(1);
  });

  sleep(1);
}
