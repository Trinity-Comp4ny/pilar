import { Link } from "react-router-dom";
import { Archive, Fingerprint, KeyRound, Lock, Scale, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Reveal } from "../components/Reveal";
import { APP_URL } from "../config";
import { usePageMeta } from "../lib/seo";

/**
 * Página pública de segurança, por princípio (decisão de 2026-11-24).
 *
 * Diz o que a Pilar faz para proteger os dados, sem listar a pilha de
 * infraestrutura nem os limites internos de operação: isso é mapa para quem quer
 * atacar, não informação para quem quer contratar. A lista de subprocessadores,
 * que a LGPD pede, fica na Política de Privacidade (seção 4). Cada afirmação aqui
 * continua tendo fonte em docs/security e docs/operations. Mudou o fato, muda aqui.
 */

type Pilar = { icone: LucideIcon; titulo: string; itens: string[] };

const PILARES: Pilar[] = [
  {
    icone: Server,
    titulo: "Dados no Brasil",
    itens: [
      "O banco de dados e os arquivos ficam em São Paulo.",
      "Cada fornecedor processa só o que a função dele exige. Não vendemos dados.",
    ],
  },
  {
    icone: Fingerprint,
    titulo: "Cada empresa isolada",
    itens: [
      "Toda informação é amarrada à empresa dona dela, com regra de acesso no próprio banco.",
      "Testes automáticos tentam ler dados de outra empresa a cada mudança de código. Se conseguirem, a mudança não sai.",
    ],
  },
  {
    icone: KeyRound,
    titulo: "Acesso protegido",
    itens: [
      "Login individual, por convite, com o papel de cada pessoa definido pelo administrador.",
      "Verificação em duas etapas com app autenticador e códigos de backup.",
      "Encerrar a sessão em todos os outros aparelhos com um clique.",
    ],
  },
  {
    icone: Lock,
    titulo: "Conexão cifrada e auditoria",
    itens: [
      "Todo acesso é por HTTPS, com política de segurança de conteúdo no app e neste site.",
      "As alterações ficam num registro de auditoria que só aceita inclusão.",
    ],
  },
  {
    icone: Archive,
    titulo: "Backup testado",
    itens: [
      "Cópia diária e cifrada do banco e dos arquivos.",
      "Todo mês, um backup é restaurado num ambiente limpo e conferido. Se falhar, a equipe é avisada.",
    ],
  },
  {
    icone: Scale,
    titulo: "LGPD na prática",
    itens: [
      "Exportar ou excluir os seus dados direto em Configurações, Privacidade.",
      "Em caso de incidente que afete seus dados, você e a ANPD são avisados, como manda a lei.",
    ],
  },
];

export function Seguranca() {
  usePageMeta({
    titulo: "Segurança e confiança | Pilar",
    descricao:
      "Como a Pilar protege os dados da sua empresa: dados no Brasil, isolamento por empresa, verificação em duas etapas, backup testado e LGPD.",
    caminho: "/seguranca",
  });

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-12 pt-28 md:px-10 md:pb-16 md:pt-36">
        <HeroBackdrop />
        <Reveal variant="up" className="relative z-10 mx-auto max-w-6xl">
          <h1 className="mb-5 max-w-3xl text-[52px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[40px] max-[850px]:text-[30px] max-[420px]:text-[26px]">
            Segurança <span className="italic text-ink/45">dos seus dados.</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
            Proposta, contrato, financeiro e obra são o coração da sua empresa. É assim que a Pilar cuida deles.
          </p>
        </Reveal>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PILARES.map(({ icone: Icone, titulo, itens }) => (
            <article key={titulo} className="rounded-[22px] border border-paper-border bg-white p-6">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-card-brand-soft">
                <Icone className="h-5 w-5 text-ink" strokeWidth={1.8} />
              </span>
              <h2 className="mb-3 text-[19px] font-medium tracking-[-0.02em] text-ink">{titulo}</h2>
              <ul className="flex flex-col gap-2">
                {itens.map((item) => (
                  <li key={item} className="text-[13.5px] leading-relaxed text-ink-soft">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-4 text-[13.5px] leading-relaxed text-ink-soft md:grid-cols-3">
          <p>
            <strong className="block font-medium text-ink">Disponibilidade</strong>
            Monitoramento contínuo do app e uma{" "}
            <a href={`${APP_URL}/status`} className="text-ink underline underline-offset-2">
              página de status
            </a>{" "}
            pública.
          </p>
          <p>
            <strong className="block font-medium text-ink">Privacidade</strong>
            Base legal, retenção, fornecedores e os seus direitos estão na{" "}
            <Link to="/privacidade" className="text-ink underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </p>
          <p>
            <strong className="block font-medium text-ink">Encontrou uma falha?</strong>
            Siga a política de reporte em{" "}
            <a href="/.well-known/security.txt" className="text-ink underline underline-offset-2">
              security.txt
            </a>
            . Dúvidas sobre dados: privacidade@pilarsoft.com.br.
          </p>
        </div>
      </section>
    </>
  );
}
