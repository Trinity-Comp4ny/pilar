import { useState } from "react";
import { Eye, EyeOff, ExternalLink, Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LinkItem } from "@/components/LinksEditor";
import { useProjetoAtividades } from "../hooks/useProjetoAtividades";
import { getSafeErrorMessage } from "@/lib/safeError";

function normalizarUrl(bruto: string): string | null {
  const t = bruto.trim();
  if (!t) return null;
  const comProtocolo = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(comProtocolo);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Links do projeto na aba Arquivos (SPEC 164): pasta compartilhada, WeTransfer, modelo 3D.
 * Com ou sem Google Drive conectado. Marcado "o cliente vê", o link aparece no portal, no
 * bloco "Arquivos do projeto". Os links são os mesmos do projeto (`projetos.links`).
 */
export function LinksDoProjeto({ projetoId, canEdit }: { projetoId: string; canEdit: boolean }) {
  const { links, salvar } = useProjetoAtividades(projetoId);
  const [url, setUrl] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [cliente, setCliente] = useState(true);

  const gravar = async (proximos: LinkItem[], sucesso: string) => {
    try {
      await salvar.mutateAsync({ links: proximos });
      toast.success(sucesso);
      return true;
    } catch (e) {
      toast.error("Não foi possível salvar o link", { description: getSafeErrorMessage(e, "Tente de novo.") });
      return false;
    }
  };

  const adicionar = async () => {
    const final = normalizarUrl(url);
    if (!final) {
      toast.error("Link inválido", { description: "Cole o endereço completo, como https://..." });
      return;
    }
    const novo: LinkItem = { url: final, ...(rotulo.trim() ? { rotulo: rotulo.trim() } : {}), cliente };
    if (await gravar([...links, novo], cliente ? "Link adicionado. O cliente vê no portal." : "Link adicionado")) {
      setUrl("");
      setRotulo("");
    }
  };

  const alternarCliente = (i: number) => {
    const proximos = links.map((l, idx) => (idx === i ? { ...l, cliente: !l.cliente } : l));
    void gravar(proximos, proximos[i].cliente ? "O cliente passa a ver este link" : "Link só para a equipe");
  };

  const remover = (i: number) =>
    void gravar(
      links.filter((_, idx) => idx !== i),
      "Link removido"
    );

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Links
          </p>
          <p className="text-xs text-muted-foreground">
            Pasta compartilhada, WeTransfer, modelo 3D. Os marcados como "o cliente vê" aparecem no portal do cliente.
          </p>
        </div>

        {links.length > 0 ? (
          <ul className="divide-y rounded-lg border" aria-label="Links do projeto">
            {links.map((l, i) => (
              <li key={`${l.url}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink hover:underline"
                >
                  <span className="truncate">{l.rotulo || l.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
                {l.cliente ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-2xs font-medium text-info-strong">
                    <Eye className="h-3 w-3" />o cliente vê
                  </span>
                ) : (
                  <span className="text-2xs text-muted-foreground">só a equipe</span>
                )}
                {canEdit && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => alternarCliente(i)}
                      disabled={salvar.isPending}
                      aria-label={
                        l.cliente
                          ? `Ocultar do cliente: ${l.rotulo || l.url}`
                          : `Mostrar ao cliente: ${l.rotulo || l.url}`
                      }
                      title={l.cliente ? "Ocultar do cliente" : "Mostrar ao cliente"}
                    >
                      {l.cliente ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remover(i)}
                      disabled={salvar.isPending}
                      aria-label={`Remover link: ${l.rotulo || l.url}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum link ainda.</p>
        )}

        {canEdit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void adicionar();
            }}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="link-url">Endereço</Label>
                <Input
                  id="link-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  inputMode="url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-rotulo">Nome (opcional)</Label>
                <Input
                  id="link-rotulo"
                  value={rotulo}
                  onChange={(e) => setRotulo(e.target.value)}
                  placeholder="Ex.: Pranchas aprovadas"
                  maxLength={200}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch id="link-cliente" checked={cliente} onCheckedChange={setCliente} />
                <Label htmlFor="link-cliente">O cliente vê no portal</Label>
              </div>
              <Button type="submit" variant="outline" size="sm" loading={salvar.isPending} disabled={!url.trim()}>
                <Plus className="h-4 w-4" />
                Adicionar link
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
