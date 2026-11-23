// Scenario: list lancamentos with filters + pagination. Stress RLS + indexes.
// Run: k6 run tests/load/scenarios/listar-lancamentos.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { authenticate } from '../utils/auth.js';
import { config, defaultStages, defaultThresholds, summaryTrendStats, supabaseHeaders } from '../utils/setup.js';

export const errors = new Counter('errors');

export const options = {
  stages: defaultStages,
  summaryTrendStats,
  thresholds: defaultThresholds,
};

const PAGE_SIZE = 25;
const TIPOS = ['receita', 'despesa'];

function listar(headers, tipo, offset) {
  const url =
    `${config.SUPABASE_URL}/rest/v1/lancamentos` +
    `?select=id,descricao,valor,tipo,data_vencimento,status` +
    `&tipo=eq.${tipo}` +
    `&order=data_vencimento.desc,id.asc` +
    `&limit=${PAGE_SIZE}` +
    `&offset=${offset}`;
  return http.get(url, {
    headers: { ...headers, Prefer: 'count=exact' },
    tags: { name: 'listar_lancamentos' },
  });
}

function totalNoContentRange(res) {
  const header = Object.keys(res.headers).find((nome) => nome.toLowerCase() === 'content-range');
  const total = header ? /\/(\d+)$/.exec(String(res.headers[header])) : null;
  return total ? Number(total[1]) : null;
}

function respostaValida(res) {
  if (res.status !== 200 && res.status !== 206) return false;
  try {
    return Array.isArray(res.json()) && totalNoContentRange(res) !== null;
  } catch {
    return false;
  }
}

export function setup() {
  const { accessToken: token } = authenticate();
  const headers = supabaseHeaders(token);
  // Verifica o contrato antes da carga e limita a amostragem às páginas que existem.
  const paginasPorTipo = TIPOS.map((tipo) => {
    const res = listar(headers, tipo, 0);
    if (!respostaValida(res)) throw new Error(`Preflight de lançamentos (${tipo}) falhou: HTTP ${res.status}.`);
    return Math.max(1, Math.min(10, Math.ceil(totalNoContentRange(res) / PAGE_SIZE)));
  });
  return { token, paginasPorTipo };
}

export default function (data) {
  const indice = Math.random() < 0.5 ? 0 : 1;
  const pagina = Math.floor(Math.random() * data.paginasPorTipo[indice]);
  const res = listar(supabaseHeaders(data.token), TIPOS[indice], pagina * PAGE_SIZE);
  if (!check(res, { 'listagem paginada válida': respostaValida })) errors.add(1);

  sleep(0.5);
}
