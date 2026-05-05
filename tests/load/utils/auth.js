// Authentication helpers for Supabase GoTrue.

import http from 'k6/http';
import { check } from 'k6';
import { config } from './setup.js';

/**
 * Authenticate against Supabase Auth and return the access token.
 * Uses password grant. Does NOT cache — call from setup() and pass token via __VU state.
 */
export function authenticate(email, password) {
  const url = `${config.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const payload = JSON.stringify({
    email: email || config.TEST_EMAIL,
    password: password || config.TEST_PASSWORD,
  });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      apikey: config.SUPABASE_KEY,
    },
    tags: { name: 'auth_login' },
  });

  const ok = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returned access_token': (r) => {
      try {
        return Boolean(r.json('access_token'));
      } catch (_e) {
        return false;
      }
    },
  });

  if (!ok) {
    throw new Error(`Auth failed: status=${res.status} body=${res.body}`);
  }

  const body = res.json();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user && body.user.id,
  };
}

/**
 * Logout (best-effort). Use in teardown when you want to invalidate tokens.
 */
export function logout(token) {
  const url = `${config.SUPABASE_URL}/auth/v1/logout`;
  return http.post(url, null, {
    headers: {
      apikey: config.SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'auth_logout' },
  });
}
