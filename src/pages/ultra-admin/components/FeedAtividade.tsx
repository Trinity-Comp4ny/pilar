import { Link } from "react-router-dom";
import {
  Building2,
  CreditCard,
  Database,
  MessageSquare,
  Settings2,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { nomeDoAtor, quandoRelativo, rotuloDoDia, type TipoEvento } from "../lib";

export type ItemFeed = {
  id: string;
  quando: string;
  ator: string | null;
  frase: string;
  detalhe?: string | null;
  tipo: TipoEvento | "dados";
  empresaId?: string | null;
  empresaNome?: string | null;
};

const ICONE: Record<ItemFeed["tipo"], LucideIcon> = {
  cadastro: UserPlus,
  empresa: Building2,
  usuarios: Users,
  cobranca: CreditCard,
  acesso: ShieldCheck,
  feedback: MessageSquare,
  sistema: Settings2,
  dados: Database,
};

/** Feed agrupado por dia: ícone do tipo, "quem fez o quê", empresa e hora. */
export function FeedAtividade({ itens, mostrarEmpresa = true }: { itens: ItemFeed[]; mostrarEmpresa?: boolean }) {
  const grupos: Array<{ dia: string; itens: ItemFeed[] }> = [];
  for (const item of itens) {
    const dia = rotuloDoDia(item.quando);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(item);
    else grupos.push({ dia, itens: [item] });
  }

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.dia} aria-label={g.dia}>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-muted">{g.dia}</h3>
          <ol className="divide-y divide-black/5">
            {g.itens.map((item) => {
              const Icon = ICONE[item.tipo];
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon size={14} strokeWidth={1.5} className="text-ink-soft" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-soft">
                      {item.ator !== null && <span className="font-medium text-ink">{nomeDoAtor(item.ator)} </span>}
                      {item.frase}
                    </p>
                    {item.detalhe && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.detalhe}</p>}
                    {mostrarEmpresa && item.empresaId && item.empresaNome && (
                      <Link
                        to={`/ultra-admin/empresas/${item.empresaId}`}
                        className="mt-0.5 inline-block text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                      >
                        {item.empresaNome}
                      </Link>
                    )}
                  </div>
                  <time
                    className="shrink-0 text-xs text-ink-muted"
                    dateTime={item.quando}
                    title={formatDateTime(item.quando)}
                  >
                    {quandoRelativo(item.quando)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
