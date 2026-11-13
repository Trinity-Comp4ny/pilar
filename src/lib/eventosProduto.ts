/**
 * Catálogo dos eventos de produto enviados ao PostHog (SPEC 098, ampliada em 2026-10-09).
 *
 * `analytics.track()` só aceita nomes daqui: evento novo entra nesta lista primeiro, e
 * nome digitado errado vira erro de compilação em vez de evento órfão no PostHog.
 * Todo evento sai com `empresa_id` (super propriedade registrada no login), o que permite
 * retenção e adoção por escritório no plano grátis do PostHog.
 *
 * Sessão: login_realizado (1x por sessão do navegador, com role) responde "quem entrou e quando";
 * erro_exibido (contexto "entidade:ação", nunca a mensagem) mostra em que módulo as pessoas travam.
 *
 * Funil de ativação: signup_completed → empresa_onboarding_concluido → cliente_criado →
 * projeto_criado → lancamento_criado. Adoção por módulo: obra_criada, rdo_registrado,
 * lead_criado, convite_enviado, ia_mensagem_enviada, relatorio_exportado, cronograma_item_criado,
 * cronograma_tarefa_concluida, importacao_financeira_concluida, proposta_enviada.
 *
 * Propriedade de evento é contagem, enum ou booleano: nunca nome, e-mail ou texto livre
 * (docs/ROPA.md, item 11). `eventosProduto.test.ts` barra evento do catálogo sem uso.
 */
export type EventoProduto =
  // Navegação
  | "$pageview"
  // Sessão e fricção
  | "login_realizado"
  | "erro_exibido"
  // Cadastro e onboarding
  | "signup_completed"
  | "signup_email_ja_cadastrado"
  | "demo_agendar_clicado"
  | "empresa_onboarding_concluido"
  | "onboarding_etapa_concluida"
  | "onboarding_objetivo_escolhido"
  | "onboarding_boas_vindas_acao"
  | "onboarding_pergunta_respondida"
  | "onboarding_dor_escolhida"
  | "onboarding_plano_gerado"
  // Uso dos módulos (ativação e adoção)
  | "cliente_criado"
  | "lead_criado"
  | "projeto_criado"
  | "proposta_status_alterado"
  | "proposta_enviada"
  | "lancamento_criado"
  | "importacao_financeira_concluida"
  | "obra_criada"
  | "rdo_registrado"
  | "cronograma_item_criado"
  | "cronograma_tarefa_concluida"
  | "convite_enviado"
  | "relatorio_exportado"
  // App na tela inicial do celular (PWA)
  | "app_instalar_acao"
  | "app_instalar_dispensado"
  | "app_instalado"
  // IA
  | "inicio_agentes_abrir"
  | "inicio_resumo_exibido"
  | "ia_mensagem_enviada"
  | "ia_acao_confirmada"
  | "ia_acao_cancelada"
  // Cobrança e trial
  | "checkout_iniciado"
  | "assinatura_ativada"
  | "pacote_tokens_comprado"
  | "trial_limite_atingido"
  | "plano_limite_ver_planos"
  | "trial_nivel_subiu"
  | "trial_desbloqueio_abandonado"
  | "trial_admin_avisado"
  | "trial_ativar_plano_iniciado"
  | "trial_ativar_plano_abandonado"
  | "trial_ativar_plano_concluido"
  | "trial_ativar_plano_tokenizacao_indisponivel";
