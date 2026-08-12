import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Link2, Plus, X } from "lucide-react";

export interface LinkItem {
  url: string;
  rotulo?: string;
}

interface LinksEditorProps {
  value: LinkItem[];
  onChange: (next: LinkItem[]) => void;
  readOnly?: boolean;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Links da unidade de trabalho (spec 013). Só a URL; sem rótulo. */
export function LinksEditor({ value, onChange, readOnly }: LinksEditorProps) {
  const [url, setUrl] = useState("");

  const add = () => {
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) return;
    onChange([...value, { url: finalUrl }]);
    setUrl("");
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="space-y-1">
          {value.map((link, i) => (
            <li key={`${link.url}-${i}`} className="flex items-center gap-2 text-sm">
              <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-foreground hover:underline inline-flex items-center gap-1"
              >
                {link.rotulo || link.url}
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  aria-label="Remover link"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        readOnly && <span className="text-xs text-muted-foreground">Sem links</span>
      )}

      {!readOnly && (
        <div className="flex gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            // Salva sozinho ao sair do campo: colou o link e clicou em Salvar/fora,
            // o link entra na lista sem precisar clicar em "Adicionar".
            onBlur={add}
            placeholder="Colar URL (repositório, drive...)"
            className="h-8 flex-1 text-xs"
          />
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
