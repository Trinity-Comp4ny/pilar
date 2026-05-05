// Scenario: 100 concurrent logins. Tests Supabase Auth + rate limit resilience.
// Run: k6 run tests/load/scenarios/login.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { config, defaultStages, defaultThresholds } from '../utils/setup.js';

export const errors = new Counter('errors');

export const options = {
  stages: defaultStages,
  thresholds: defaultThresholds,
};

export default function () {
  const url = `${config.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const payload = JSON.stringify({
    email: config.TEST_EMAIL,
    password: config.TEST_PASSWORD,
  });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_KEY,
    },
    tags: { name: 'login' },
  });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has access_token': (r) => {
      try {
        return Boolean(r.json('access_token'));
      } catch (_e) {
        return false;
      }
    },
    'duration < 500ms': (r) => r.timings.duration < 500,
  });

  if (!ok) errors.add(1);

  sleep(1);
}
