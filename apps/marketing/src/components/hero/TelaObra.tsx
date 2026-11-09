import { m } from "framer-motion";
import { CalendarDays, CloudSun, HardHat, Wallet } from "lucide-react";
import { EASE } from "../../lib/motion";
import { KPICard, PageHeader } from "./SceneChrome";
import { idx } from "./scene";

/**
 * Tela de Obra, o terceiro pilar, copiada do detalhe da obra no app
 * (`src/pages/obras/[id]`): mesmas abas, na mesma ordem.
 *
 * Fecha a história da cena: o projeto que nasceu do lead está em execução, as
 * frentes avançam e o diário de hoje chega do celular do campo sem ninguém
 * digitar nada no escritório.
 */

const ABAS_OBRA = ["Visão", "Diário", "Cronograma", "Tarefas", "Cotações", "Estoque", "Conta da obra", "Acessos"];

const FRENTES = [
  { nome: "Demolição e preparo", pct: 100 },
  { nome: "Rede de dutos", pct: 82 },
  { nome: "Gases medicinais", pct: 46 },
  { nome: "Forro e acabamento", pct: 12 },
];

const DIARIO = [
  ["Serviço", "Rede de gases, 2º pav."],
  ["Executado", "18 m de tubulação"],
  ["Efetivo", "14 pessoas"],
  ["Ocorrência", "1, falta de luva 22 mm"],
] as const;

export function TelaObra({ ato }: { ato: number }) {
  const ligado = ato >= idx("obra");

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        titulo="Bloco cirúrgico, Hospital Santa Rita"
        trilha="Obras"
        secundarias={["Portal do cliente"]}
        acao={{ label: "Novo diário" }}
      />

      <div className="shrink-0 flex items-center gap-5 px-6 border-b border-black/5">
        {ABAS_OBRA.map((aba, i) => (
          <span
            key={aba}
            className={`pb-2 -mb-px border-b-2 text-[11.5px] ${
              i === 0 ? "border-ink font-medium text-ink" : "border-transparent text-black/60"
            }`}
          >
            {aba}
          </span>
        ))}
      </div>

      <div className="flex-1 px-6 py-4 overflow-hidden">
        <div className="grid grid-cols-4 gap-2.5 mb-3">
          {[
            { rotulo: "Avanço físico", valor: "58%", sub: "Previsto 61%", icone: HardHat },
            { rotulo: "Conta da obra", valor: "R$ 212.400", sub: "de R$ 340.000 orçado", icone: Wallet },
            { rotulo: "Entrega", valor: "30/11", sub: "No prazo", icone: CalendarDays },
            { rotulo: "Clima", valor: "24°", sub: "Sem chuva até sexta", icone: CloudSun },
          ].map((k, i) => (
            <m.div
              key={k.rotulo}
              animate={{ opacity: ligado ? 1 : 0, y: ligado ? 0 : 8 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: EASE.out }}
            >
              <KPICard rotulo={k.rotulo} valor={k.valor} sub={k.sub} icone={k.icone} compacto />
            </m.div>
          ))}
        </div>

        <div className="grid grid-cols-[1.2fr_1fr] gap-3">
          {/* Frentes de serviço: o avanço que o diário alimenta. */}
          <div className="rounded-2xl border border-black/5 bg-white p-4">
            <p className="mb-3 text-[12px] font-medium text-ink">Frentes de serviço</p>
            <div className="flex flex-col gap-3.5">
              {FRENTES.map((f, i) => (
                <div key={f.nome}>
                  <div className="mb-1 flex justify-between text-[10.5px]">
                    <span className="text-ink">{f.nome}</span>
                    <span className="font-medium tabular-nums text-ink">{f.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-app-muted">
                    <m.span
                      className={`block h-full w-full origin-left rounded-full ${
                        f.pct === 100 ? "bg-status-done" : "bg-brand"
                      }`}
                      initial={false}
                      animate={{ scaleX: ligado ? f.pct / 100 : 0 }}
                      transition={{ duration: 0.7, delay: ligado ? 0.15 + i * 0.08 : 0, ease: EASE.out }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-ink-muted">Atualizado pelo diário de hoje, 10h42</p>
          </div>

          {/* Diário de hoje: chega do celular do encarregado, já com fotos. */}
          <m.div
            className="rounded-2xl border border-black/5 bg-white p-4"
            initial={false}
            animate={{ opacity: ligado ? 1 : 0, x: ligado ? 0 : 24 }}
            transition={{ duration: 0.45, delay: ligado ? 0.5 : 0, ease: EASE.out }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-medium text-ink">Diário de hoje</p>
              <span className="flex items-center gap-1.5 rounded-full bg-positive/10 px-2 py-0.5 text-[9.5px] font-medium text-positive-strong">
                <m.span
                  className="h-1.5 w-1.5 rounded-full bg-positive"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                Veio do campo
              </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {["from-modulo-obra/60", "from-modulo-projetos/60", "from-modulo-gestao/60"].map((cor, i) => (
                <m.span
                  key={cor}
                  className={`block aspect-[4/3] rounded-lg bg-gradient-to-br ${cor} to-app-muted`}
                  initial={false}
                  animate={{ opacity: ligado ? 1 : 0, scale: ligado ? 1 : 0.9 }}
                  transition={{ duration: 0.35, delay: ligado ? 0.75 + i * 0.08 : 0, ease: EASE.out }}
                />
              ))}
            </div>

            {DIARIO.map(([chave, valor]) => (
              <div
                key={chave}
                className="flex justify-between gap-3 border-b border-black/5 py-[5px] text-[10.5px] last:border-0"
              >
                <span className="text-ink-muted">{chave}</span>
                <span className="text-right font-medium text-ink">{valor}</span>
              </div>
            ))}

            <p className="mt-2.5 text-[10px] text-ink-muted">Registrado por J. Lima no Pilar Campo</p>
          </m.div>
        </div>
      </div>
    </div>
  );
}
