/**
 * Checkly config — synthetic monitoring para Pilar.
 *
 * Deploy: `npx checkly deploy`
 * Login:  `npx checkly login`
 *
 * Env vars necessárias (Checkly dashboard ou .env local):
 *  - CHECKLY_ACCOUNT_ID
 *  - CHECKLY_API_KEY
 *  - PILAR_BASE_URL          ex: https://app.pilarsoft.com.br
 *  - PILAR_HEALTH_URL        ex: https://<project>.supabase.co/functions/v1/health
 *  - PILAR_TURNSTILE_VERIFY_URL
 *  - ALERT_EMAIL             email pra notificações
 *  - SLACK_WEBHOOK_URL       opcional, alertas críticos no Slack
 */

import { defineConfig } from "checkly";

const config = defineConfig({
  projectName: "Pilar",
  logicalId: "pilar-monitoring",
  repoUrl: "https://github.com/labrynth-ai/pilar",
  checks: {
    activated: true,
    muted: false,
    runtimeId: "2024.02",
    frequency: 5, // default 5min — sobrescrito por check
    locations: ["us-east-1", "sa-east-1"],
    tags: ["pilar", "production"],
    alertChannels: [],
    checkMatch: "**/tests/synthetic/*.spec.ts",
    browserChecks: {
      frequency: 10,
      testMatch: "**/tests/synthetic/*.spec.ts",
    },
  },
  cli: {
    runLocation: "us-east-1",
    reporters: ["list"],
  },
});

export default config;
