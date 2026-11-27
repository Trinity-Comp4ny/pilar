# Tela ao vivo sem Docker (`npm run dev:mock`)

Para ver e iterar uma tela com HMR sem subir o Supabase local (3 a 4 GB de RAM com
Docker). O Vite roda o app normal e simula o Supabase (auth e PostgREST) no mesmo
servidor, com dado seed fictício.

```
npm run dev:mock      # http://localhost:8081
```

- Login automático como `dev@local.test` (admin, onboarding completo, assinatura ativa).
- Volume de leads pela URL: `/gestao/leads?leads=0` (vazio), `?leads=12` (padrão), `?leads=500`.
- Tabela sem seed responde `200 []`, então a tela abre vazia em vez de quebrar.

## O que NÃO cobre

Escrita, RLS, triggers, RPC e edge functions: toda gravação responde `200 []` e nada
persiste. Isso segue nos testes (Vitest, pgTAP) e no CI. Serve para olhar e ajustar
layout, estados e responsividade, não para validar regra de negócio.

## Acrescentar uma tela

Dado em `scripts/dev-mock/seed.mjs` (função `tabelas`: nome da tabela ou view → linhas).
O plugin está em `scripts/dev-mock/plugin.mjs`, só no `serve` (nunca entra em build).
Dado de cliente real não entra: o repo é público.

## Capturas para o antes e depois do PR

Com o servidor de pé, Playwright abre `http://localhost:8081/<rota>` sem interceptar
nada. Ver `docs/design/ANTES_DEPOIS_PR.md`.
