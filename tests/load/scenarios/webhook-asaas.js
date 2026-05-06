// Scenario: 500 Asaas webhook calls. Tests idempotency + edge function performance.
// Run: k6 run tests/load/scenarios/webhook-asaas.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { config, defaultThresholds } from '../utils/setup.js';

export const errors = new Counter('errors');

// Override default stages: webhook needs spike up to 500 VUs.
export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    ...defaultThresholds,
    // Webhooks devem ser rápidos (idempotência via DB unique key)
    http_req_duration: ['p(95)<800'],
  },
};

const ASAAS_WEBHOOK_TOKEN = __ENV.K6_ASAAS_WEBHOOK_TOKEN || '';

function buildPayload(eventId) {
  return JSON.stringify({
    id: eventId,
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: `pay_${eventId}`,
      customer: `cus_loadtest_${(__VU % 50) + 1}`,
      value: Math.round(Math.random() * 100000) / 100,
      netValue: Math.round(Math.random() * 100000) / 100,
      billingType: 'BOLETO',
      status: 'RECEIVED',
      dueDate: new Date().toISOString().slice(0, 10),
      paymentDate: new Date().toISOString().slice(0, 10),
      externalReference: `loadtest-${eventId}`,
    },
  });
}

export default function () {
  // Para testar idempotência: 30% dos eventos repetem ID. Edge function deve dedupe.
  const reuseId = Math.random() < 0.3;
  const eventId = reuseId
    ? `evt_dup_${__VU % 20}`
    : `evt_${__VU}_${__ITER}_${Date.now()}`;

  const url = `${config.SUPABASE_URL}/functions/v1/webhook-asaas`;
  const headers = {
    'Content-Type': 'application/json',
    apikey: config.SUPABASE_KEY,
    'asaas-access-token': ASAAS_WEBHOOK_TOKEN,
  };

  const res = http.post(url, buildPayload(eventId), {
    headers,
    tags: { name: 'webhook_asaas' },
  });

  const ok = check(res, {
    // 200 = processed, 409/202 = duplicate ack (idempotência ok)
    'status acceptable': (r) => [200, 202, 409].includes(r.status),
    'duration < 800ms': (r) => r.timings.duration < 800,
  });

  if (!ok) errors.add(1);

  sleep(0.2);
}
