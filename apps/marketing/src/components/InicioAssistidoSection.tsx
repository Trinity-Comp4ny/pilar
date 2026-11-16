import { Link } from "react-router-dom";
import { trackCta } from "../analytics";
import { WHATSAPP_COMERCIAL_URL } from "../lib/contato";
import { ETAPAS_INICIO } from "../lib/implantacao";
import { Reveal } from "./Reveal";
import { SplitButton } from "./ui/SplitButton";

/** O caminho para começar, sem transformar ajuda incluída em taxa obrigatória. */
export function InicioAssistidoSection({ contexto }: { contexto: string }) {
  return (
    <section
      id="implantacao"
      aria-labelledby="inicio-assistido-titulo"
      className="bg-paper px-5 pb-16 md:px-10 md:pb-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal variant="up" className="mb-8 max-w-2xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">Como começar</p>
          <h2
            id="inicio-assistido-titulo"
            className="mb-4 text-[36px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[30px] max-[850px]:text-[25px]"
          >
            Comece por uma rotina <span className="italic text-ink/45">do escritório.</span>
          </h2>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Você pode contratar pelo site e começar pelos projetos ativos. A ajuda para entrar e os canais de
            atendimento seguem o plano escolhido.
          </p>
        </Reveal>

        <ol className="mb-8 grid gap-6 md:grid-cols-3">
          {ETAPAS_INICIO.map((etapa, i) => (
            <li key={etapa.titulo} className="border-t border-paper-border pt-5">
              <p aria-hidden="true" className="mb-3 text-[12px] font-medium tabular-nums text-ink-muted">
                0{i + 1}
              </p>
              <h3 className="mb-2 text-[17px] font-medium text-ink">{etapa.titulo}</h3>
              <p className="text-[14px] leading-relaxed text-ink-soft">{etapa.texto}</p>
            </li>
          ))}
        </ol>

        <Reveal variant="up" className="grid gap-8 rounded-[24px] bg-card-brand-soft/50 p-6 md:grid-cols-2 md:p-8">
          <div>
            <h3 className="mb-3 text-[19px] font-medium text-ink">O atendimento do plano continua incluído</h3>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Essencial: suporte por e-mail e WhatsApp. Profissional: migração assistida da planilha. Escala:
              implantação acompanhada e canal direto. Ao concluir a entrada, o suporte de uso continua enquanto a
              assinatura estiver ativa.
            </p>
            <Link
              to="/faq"
              className="mt-4 inline-flex text-[13.5px] font-medium text-ink underline underline-offset-4"
            >
              Entenda a implantação e o suporte
            </Link>
          </div>
          <div>
            <h3 className="mb-3 text-[19px] font-medium text-ink">Precisa de trabalho adicional?</h3>
            <p className="mb-5 text-[14px] leading-relaxed text-ink-soft">
              Organização de histórico, treinamentos extras e visitas presenciais são avaliados sob proposta. Você
              recebe o escopo, o período de acompanhamento e o valor antes de contratar. O que já está incluído no plano
              é considerado nessa definição.
            </p>
            <SplitButton
              href={WHATSAPP_COMERCIAL_URL}
              onClick={() => trackCta("consultar_implantacao", contexto)}
              tamanho="sm"
              fantasma
            >
              Conversar sobre implantação
            </SplitButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
