// Contato comercial do Pilar. Desde 19/10/2026 o cadastro é por convite (SPEC 133):
// quem não tem conta agenda uma demonstração com o time. Trocar o link aqui (ex.:
// página de agendamento do Google Agenda) muda todos os pontos do app de uma vez.
const WHATSAPP_COMERCIAL = "5514998721100";

const TEXTO_DEMO = "Olá! Quero conhecer o Pilar e agendar uma demonstração para o meu escritório.";

export const DEMO_URL = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(TEXTO_DEMO)}`;

// Fechado, /cadastro redireciona para o login e o banco recusa conta nova sem
// convite (platform_settings.cadastro_aberto). Reabrir é ligar os dois.
export const CADASTRO_ABERTO = false;
