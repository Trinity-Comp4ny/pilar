import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Regras de compiler do react-hooks v7 (chegaram no bump para eslint@10 de
      // 2026-07-25, que zerou 5 advisories high da cadeia minimatch/brace-expansion).
      // O codebase antecede elas: 71 ocorrências medidas na adoção, nenhuma é bug
      // conhecido. Ficam visíveis como warning para corrigir aos poucos, em vez de
      // travar todo merge. Condição de saída: quando a contagem chegar a zero num
      // módulo, subir para "error" com um override por pasta.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // ADR 0008 (design system): páginas não definem cor de componente na mão.
    // Warning na onda 1; vira "error" quando a onda correspondente da spec 003
    // zerar as ocorrências legadas.
    files: ["src/pages/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          // padrão da deriva: fundo sólido bg-brand + hover na MESMA string
          // (hover isolado em chip/nav é tint legítimo e passa)
          selector: 'Literal[value=/(?=.*\\bbg-brand\\s)(?=.*hover:bg-brand\\u002F\\d)/]',
          message: "Use <Button variant=\"brand\"> em vez de re-estilizar com bg-brand/hover (ADR 0008).",
        },
        {
          selector: 'JSXAttribute[name.name="variant"] Literal[value="orange"]',
          message: 'variant="orange" foi renomeada: use variant="brand" (ADR 0008).',
        },
        {
          selector: "Literal[value=/\\b(?:bg|text|border)-(?:emerald|red|green|amber|yellow|blue|slate|gray|zinc)-\\d{2,3}\\b/]",
          message: "Cor primitiva Tailwind em página: use token semântico de src/styles/tokens.css (ADR 0008).",
        },
        {
          selector: 'NewExpression[callee.object.name="Intl"][callee.property.name="NumberFormat"]',
          message: "Formatação centralizada: importe de @/lib/format (ADR 0008).",
        },
      ],
    },
  }
);
