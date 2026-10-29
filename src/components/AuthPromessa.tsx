import { CheckCircle2 } from "lucide-react";

// Mensagens-chave da marca (brand/messaging.md): reusar literalmente, sem reescrever por tela.
const TAGLINE = "Do contrato à execução, num fluxo só.";
const ASSINATURA_AGENTES = "A IA prepara. O sistema confere. Você aprova.";
const PONTOS = [
  "Agentes preparam, você aprova",
  "Proposta, projeto, obra e financeiro conectados",
  "Canteiro e cliente acompanham por dentro",
];

/**
 * Texto do painel escuro das telas de entrada (login, recuperar senha, MFA). Antes cada tela
 * repetia o discurso antigo (financeiro, projetos e CRM); agora todas dizem o mesmo e a mudança
 * é num lugar só.
 */
export function AuthPromessa() {
  return (
    <div className="space-y-8 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
      <div className="space-y-3">
        <p className="text-3xl font-light leading-snug text-balance">{TAGLINE}</p>
        <p className="text-base text-white/70">{ASSINATURA_AGENTES}</p>
      </div>

      <ul className="flex flex-col items-end gap-3 pt-4 border-t border-white/20">
        {PONTOS.map((ponto) => (
          <li key={ponto} className="flex items-center gap-2 text-sm font-medium text-white/80">
            <span>{ponto}</span>
            <CheckCircle2 className="w-5 h-5 text-brand" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}
