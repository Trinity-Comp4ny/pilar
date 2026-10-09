/**
 * Catálogo dos eventos de produto enviados ao PostHog (SPEC 098, ampliada em 2026-10-09).
 *
 * `analytics.track()` só aceita nomes daqui: evento novo entra nesta lista primeiro, e
 * nome digitado errado vira erro de compilação em vez de evento órfão no PostHog.
 * Todo evento sai com `empresa_id` (super propriedade registrada no login), o que permite
 * retenção e adoção por escritório no plano grátis do PostHog.
 *
 * Funil de ativação: signup_completed → empresa_onboarding_concluido → cliente_criado →
 * projeto_criado → lancamento_criado. Adoção por módulo: obra_criada, rdo_registrado,
 * lead_criado, convite_enviado, ia_mensagem_enviada, relatorio_exportado.
 */
export type EventoProduto =
  // Navegação
  | "$pageview"
  // Cadastro e onboarding
  | "signup_completed"
  | "signup_email_ja_cadastrado"
  | "empresa_onboarding_concluido"
  // Uso dos módulos (ativação e adoção)
  | "cliente_criado"
  | "lead_criado"
  | "projeto_criado"
  | "proposta_status_alterado"
  | "lancamento_criado"
  | "obra_criada"
  | "rdo_registrado"
  | "convite_enviado"
  | "relatorio_exportado"
  // IA
  | "inicio_agentes_abrir"
  | "ia_mensagem_enviada"
  | "ia_acao_confirmada"
  | "ia_acao_cancelada"
  // Cobrança e trial
  | "checkout_iniciado"
  | "assinatura_ativada"
  | "pacote_tokens_comprado"
  | "trial_limite_atingido"
  | "trial_nivel_subiu"
  | "trial_desbloqueio_abandonado"
  | "trial_admin_avisado"
  | "trial_ativar_plano_iniciado"
  | "trial_ativar_plano_abandonado"
  | "trial_ativar_plano_concluido"
  | "trial_ativar_plano_tokenizacao_indisponivel";
