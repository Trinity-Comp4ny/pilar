// Contato comercial. Desde 19/10/2026 o cadastro é por convite (SPEC 133): todo
// CTA de entrada leva para agendar a demonstração com o time. Trocar o link aqui
// (ex.: página de agendamento do Google Agenda) muda a landing inteira de uma vez.
const WHATSAPP_COMERCIAL = "5514998721100";

const TEXTO_DEMO = "Olá! Quero conhecer o Pilar e agendar uma demonstração para o meu escritório.";

export const DEMO_URL = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(TEXTO_DEMO)}`;
