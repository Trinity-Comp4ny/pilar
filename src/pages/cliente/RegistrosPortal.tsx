import { rotuloDoDia } from "@/lib/registrosObra";
import type { ClienteObraRegistro } from "./useClienteObraData";

/**
 * Registros da equipe que o gestor liberou ao cliente (SPEC 135, fase C): data, texto e fotos.
 * Nunca autor, áudio, efetivo nem pendência: o que chega aqui já veio filtrado do banco.
 */
export function RegistrosPortal({
  registros,
  fotosPorRegistro,
}: {
  registros: ClienteObraRegistro[];
  fotosPorRegistro: Record<string, string[]>;
}) {
  if (registros.length === 0) return null;

  return (
    <section aria-label="Registros da equipe">
      <h2 className="mb-3 text-sm font-semibold">Registros da equipe</h2>
      <ul className="mx-auto max-w-xl space-y-3">
        {registros.map((r) => {
          const fotos = fotosPorRegistro[r.id] ?? [];
          return (
            <li key={r.id} className="space-y-2 rounded-2xl border border-border/60 bg-white p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotuloDoDia(r.data)}</p>
              {r.texto && <p className="text-sm text-ink">{r.texto}</p>}
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.slice(0, 6).map((url, i) => (
                    <img
                      key={url}
                      src={url}
                      alt={`Foto ${i + 1} do registro de ${rotuloDoDia(r.data)}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
