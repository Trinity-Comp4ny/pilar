import { useState } from "react";
import { Link } from "react-router-dom";

const FLUXOS = {
  projeto: [
    {
      etapa: "Proposta",
      titulo: "Escopo e valores por disciplina",
      detalhe: "Projeto fictício de uma clínica. Separe estrutural, elétrica e hidráulica na proposta do escritório.",
      href: "/funcionalidades/propostas",
    },
    {
      etapa: "Cronograma",
      titulo: "Entregas e dependências à vista",
      detalhe: "No cronograma, confira quem entrega cada disciplina e quais atividades dependem dela.",
      href: "/funcionalidades/cronograma",
    },
    {
      etapa: "Cliente",
      titulo: "Entregas e parcelas compartilhadas",
      detalhe: "O cliente acompanha o que o escritório compartilhou no portal.",
      href: "/portal",
    },
  ],
  agente: [
    {
      etapa: "Pedir",
      titulo: "Registre uma receita em linguagem natural",
      detalhe: "Exemplo: recebi R$ 2.400 pela primeira parcela do projeto elétrico da clínica.",
      href: "/gestao",
    },
    {
      etapa: "Conferir",
      titulo: "Revise o rascunho",
      detalhe: "Confira o valor, a categoria e o projeto antes de aprovar o lançamento.",
      href: "/funcionalidades/financeiro",
    },
    {
      etapa: "Confirmar",
      titulo: "Consulte o resultado no financeiro",
      detalhe: "Depois da confirmação, consulte o lançamento na lista financeira.",
      href: "/funcionalidades/financeiro",
    },
  ],
} as const;

export function FluxoDemonstrativo({ tipo = "projeto" }: { tipo?: keyof typeof FLUXOS }) {
  const [indice, setIndice] = useState(0);
  const fluxo = FLUXOS[tipo];
  const atual = fluxo[indice];

  return (
    <section className="mx-auto my-12 max-w-5xl rounded-3xl border border-paper-border bg-frame p-5 md:p-9">
      <h2 className="text-2xl font-medium text-ink">
        {tipo === "agente" ? "Da solicitação ao lançamento" : "Da proposta ao acompanhamento do cliente"}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">Demonstração ilustrativa</p>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Etapas da demonstração">
        {fluxo.map((item, posicao) => (
          <button
            key={item.etapa}
            type="button"
            aria-pressed={indice === posicao}
            onClick={() => setIndice(posicao)}
            className="rounded-full border border-paper-border px-4 py-2 font-medium text-ink aria-pressed:bg-card-brand"
          >
            {item.etapa}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-paper p-5" aria-live="polite">
        <h3 className="text-lg font-medium text-ink">{atual.titulo}</h3>
        <p className="mt-2">{atual.detalhe}</p>
        <Link to={atual.href} className="mt-3 inline-block font-medium text-ink underline">
          Conheça o recurso
        </Link>
      </div>
    </section>
  );
}
