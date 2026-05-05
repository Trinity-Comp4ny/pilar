/**
 * i18n base setup.
 *
 * Strings devem ser migradas progressivamente. Use `useTranslation('namespace')`
 * em novos componentes — não há necessidade de migrar todas as pages de uma vez.
 *
 * Namespaces atuais:
 *  - common      → ações, estados, respostas (Salvar/Cancelar/Sim/Não/...)
 *  - auth        → login, senha, sessão
 *  - financeiro  → receita/despesa/vencimento e afins
 *
 * Adicionar um namespace novo:
 *  1. criar `src/locales/pt-BR/<ns>.json` (e o equivalente em `en/`)
 *  2. importar abaixo e registrar em `resources`
 *  3. consumir com `useTranslation('<ns>')`
 *
 * Detecção de idioma usa LanguageDetector (querystring → cookie → localStorage → navigator).
 * Fallback: pt-BR.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ptBRCommon from "@/locales/pt-BR/common.json";
import ptBRAuth from "@/locales/pt-BR/auth.json";
import ptBRFinanceiro from "@/locales/pt-BR/financeiro.json";

import enCommon from "@/locales/en/common.json";
import enAuth from "@/locales/en/auth.json";
import enFinanceiro from "@/locales/en/financeiro.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": {
        common: ptBRCommon,
        auth: ptBRAuth,
        financeiro: ptBRFinanceiro,
      },
      en: {
        common: enCommon,
        auth: enAuth,
        financeiro: enFinanceiro,
      },
    },
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR", "en"],
    defaultNS: "common",
    ns: ["common", "auth", "financeiro"],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
