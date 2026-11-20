import { useState } from "react";
import { toast } from "sonner";
import { PropostaLinkVersao } from "@/components/propostas/PropostaLinkVersao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePropostaVersoes } from "@/hooks/usePropostaVersoes";

export function PropostaLinksPanel({
  id,
  valor,
  validade,
  podePublicar,
}: {
  id: string;
  valor: number | null;
  validade: string | null;
  podePublicar: boolean;
}) {
  const versoes = usePropostaVersoes(id, [id], true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [anexando, setAnexando] = useState(false);

  const anexar = async () => {
    if (!arquivo || valor === null) return;
    try {
      await versoes.adicionar.mutateAsync({ propostaId: id, arquivo, valor, validade, condicoes: "", motivo: "" });
      setArquivo(null);
      setAnexando(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível anexar o PDF.");
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="Links da proposta">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Links da proposta</h3>
        {podePublicar && valor !== null && !anexando && (
          <Button size="sm" variant="outline" onClick={() => setAnexando(true)}>
            Anexar PDF da versão
          </Button>
        )}
      </div>
      {versoes.isError ? (
        <Button variant="ghost" size="sm" onClick={() => void versoes.refetch()}>
          Tentar carregar versões novamente
        </Button>
      ) : versoes.isPending ? (
        <p className="text-xs text-muted-foreground">Carregando versões…</p>
      ) : (
        versoes.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Anexe o PDF enviado ao cliente para publicar um link rastreável.
          </p>
        )
      )}
      {anexando && (
        <div className="space-y-2">
          <Label htmlFor="proposta-link-arquivo">PDF com o escopo e as condições desta versão</Label>
          <Input
            id="proposta-link-arquivo"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!arquivo} loading={versoes.adicionar.isPending} onClick={() => void anexar()}>
              Salvar versão
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={versoes.adicionar.isPending}
              onClick={() => {
                setArquivo(null);
                setAnexando(false);
              }}
            >
              Cancelar anexo
            </Button>
          </div>
        </div>
      )}
      {versoes.data?.map((versao, i) => (
        <div key={versao.id} className="space-y-2 border-t pt-2">
          <p className="text-xs font-medium">
            V{versao.numero} · {versao.nome_arquivo}
          </p>
          <PropostaLinkVersao versao={versao} podePublicar={podePublicar && i === 0} podeRevogar={podePublicar} />
        </div>
      ))}
    </section>
  );
}
