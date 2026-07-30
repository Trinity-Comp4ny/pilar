import { useProjetoAtividades } from "../hooks/useProjetoAtividades";
import { AtividadeComposer } from "./AtividadeComposer";

interface ProjetoAtividadesPanelProps {
  projetoId: string;
  pessoas: { id: string; nome: string }[];
  autorNome: string;
}

/** Painel de atividades do projeto (só comentários; os links vivem no conteúdo). */
export function ProjetoAtividadesPanel({ projetoId, pessoas, autorNome }: ProjetoAtividadesPanelProps) {
  const { comentarios, salvar } = useProjetoAtividades(projetoId);

  const adicionar = (texto: string, mencionados: string[]) => {
    salvar.mutate({
      comentarios: [
        ...comentarios,
        {
          id: crypto.randomUUID(),
          texto,
          autor: autorNome,
          data: new Date().toISOString(),
          mencionados: mencionados.length ? mencionados : undefined,
        },
      ],
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
        {comentarios.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma atividade ainda</p>
        ) : (
          comentarios.map((c) => (
            <div key={c.id} className="rounded-lg border bg-background p-3 text-sm shadow-sm">
              <p className="whitespace-pre-wrap text-foreground">{c.texto}</p>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>{c.autor}</span>
                <span>{new Date(c.data).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex-shrink-0 pt-3">
        <AtividadeComposer pessoas={pessoas} onSubmit={adicionar} />
      </div>
    </div>
  );
}
