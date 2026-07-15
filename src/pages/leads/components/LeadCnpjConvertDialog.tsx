import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus, Building2, Check } from "lucide-react";
import { formatCNPJ } from "@/lib/maskUtils";
import { isValidCNPJ, lookupCNPJ, type CnpjLookup } from "@/lib/brasilApi";
import { toast } from "sonner";

export type ConvertEnrichment = {
  cnpj: string | null;
  razao_social: string | null;
  endereco: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConvert: (enrichment: ConvertEnrichment | null) => void;
  onSkip: () => void;
};

export function LeadCnpjConvertDialog({ open, onOpenChange, isPending, onConvert, onSkip }: Props) {
  const [cnpj, setCnpj] = useState("");
  const [lookup, setLookup] = useState<CnpjLookup | null>(null);
  const [searching, setSearching] = useState(false);

  const reset = () => {
    setCnpj("");
    setLookup(null);
    setSearching(false);
  };

  const handleSearch = async () => {
    if (!isValidCNPJ(cnpj)) {
      toast.error("CNPJ inválido", { description: "Verifique os dígitos." });
      return;
    }
    setSearching(true);
    const data = await lookupCNPJ(cnpj);
    setSearching(false);
    if (!data) {
      toast.error("CNPJ não encontrado na Receita");
      return;
    }
    setLookup(data);
  };

  const handleConvertWithCnpj = () => {
    if (!lookup) return;
    onConvert({
      cnpj: lookup.cnpj,
      razao_social: lookup.razao_social,
      endereco: [lookup.logradouro, lookup.numero, lookup.bairro, lookup.municipio, lookup.uf, lookup.cep]
        .filter(Boolean)
        .join(", "),
    });
    reset();
  };

  const handleConvertWithoutCnpj = () => {
    onConvert(null);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-positive-strong" />
            Lead Ganho!
          </DialogTitle>
          <DialogDescription>
            Informe o CNPJ para criar o cliente já com razão social, endereço e dados da Receita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input
                value={cnpj}
                onChange={(e) => {
                  setCnpj(formatCNPJ(e.target.value));
                  setLookup(null);
                }}
                placeholder="00.000.000/0000-00"
                disabled={searching || isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={!isValidCNPJ(cnpj) || searching || isPending}
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {lookup && (
            <div className="rounded-lg border border-positive/20 bg-positive/5 p-3 text-sm">
              <div className="flex items-center gap-2 mb-2 text-positive-strong font-medium">
                <Building2 className="h-4 w-4" />
                {lookup.razao_social}
              </div>
              {lookup.nome_fantasia && <div className="text-xs text-black/60">Fantasia: {lookup.nome_fantasia}</div>}
              <div className="text-xs text-black/60 mt-1">
                {[lookup.logradouro, lookup.numero, lookup.bairro].filter(Boolean).join(", ")}
              </div>
              <div className="text-xs text-black/60">
                {lookup.municipio}/{lookup.uf} · CEP {lookup.cep}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-positive-strong">
                <Check className="h-3 w-3" /> Dados serão copiados ao cliente
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onSkip} disabled={isPending}>
            Apenas marcar como Ganho
          </Button>
          <Button variant="outline" onClick={handleConvertWithoutCnpj} disabled={isPending}>
            Criar sem CNPJ
          </Button>
          <Button
            onClick={handleConvertWithCnpj}
            disabled={!lookup || isPending}
            className="bg-positive hover:bg-positive/90 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Convertendo...
              </>
            ) : (
              "Criar Cliente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
