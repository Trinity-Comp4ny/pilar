// Contato comercial. Desde 19/10/2026 o cadastro é por convite (SPEC 133): todo
// CTA de entrada leva para uma conversa com o time no WhatsApp.
const WHATSAPP_COMERCIAL = "5514998721100";

const TEXTO_DEMO = "Olá! Quero conhecer o Pilar e agendar uma demonstração para o meu escritório.";

export const WHATSAPP_DEMO = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(TEXTO_DEMO)}`;
