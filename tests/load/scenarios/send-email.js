// Scenario: envio de email de proposta via Edge Function.
// Valida que o endpoint suporta carga e que rate limiting responde corretamente.
// Run: k6 run tests/load/scenarios/send-email.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { authenticate } from '../utils/auth.js';
import { config, supabaseHeaders } from '../utils/setup.js';

export const errors = new Counter('errors');
export const rateLimited = new Rate('rate_limited');

// Carga baixa — endpoint de email tem rate limit intencional.
export const options = {
  stages: [
    { duration: '30s', target: 3 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // emails podem ser lentos (Resend roundtrip)
    http_req_failed: ['rate<0.05'],     // 5% falhas OK (inclui 429 esperados)
    errors: ['count<5'],
    rate_limited: ['rate<0.5'],          // menos de 50% dos requests devem virar 429
  },
};

export function setup() {
  const session = authenticate();
  return { token: session.accessToken, userId: session.userId };
}

export default function (data) {
  const headers = supabaseHeaders(data.token);

  // Payload mínimo válido — attachment pequeno em base64 para não lotar a rede
  const smallPdf = btoa('mock-pdf-content-for-load-test');

  const payload = JSON.stringify({
    email: `loadtest+vu${__VU}@example.com`,
    subject: `Proposta LoadTest VU${__VU}`,
    mensagem: 'Teste de carga — ignorar.',
    attachment_base64: smallPdf,
    filename: 'proposta.pdf',
    proposta_id: '00000000-0000-0000-0000-000000000001',
    nome_cliente: 'Cliente Teste',
    doc_mode: 'pdf',
  });

  const res = http.post(
    `${config.SUPABASE_URL}/functions/v1/send-proposta-email`,
    payload,
    { headers, tags: { name: 'send-proposta-email' } },
  );

  const ok = check(res, {
    'resposta válida': (r) => r.status === 200 || r.status === 429 || r.status === 400,
    'não é erro de servidor': (r) => r.status < 500,
  });

  if (res.status === 429) {
    rateLimited.add(1);
  } else if (!ok || res.status >= 500) {
    errors.add(1);
    console.error(`[send-email] VU${__VU} status=${res.status} body=${res.body?.slice(0, 200)}`);
  } else {
    rateLimited.add(0);
  }

  sleep(2);
}
