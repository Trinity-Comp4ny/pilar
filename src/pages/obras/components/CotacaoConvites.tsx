import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialog } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { getSafeErrorMessage } from "@/lib/safeError";
import { diaDoTimestamp, estadoDoConvite, linkDaCotacao, podeRevogarConvite } from "@/lib/cotacaoConvite";
import { useFornecedoresLite } from "@/hooks/useFornecedorDetalhe";
import { useConvitesCotacao, useCriarConvite, useRevogarConvite } from "@/pages/obras/hooks/useCotacaoConvites";
import { type CotacaoComPropostas } from "@/pages/obras/hooks/useObraCotacoes";

const NOVO = "__novo__";
const VALIDADES = [3, 7, 15, 30];

interface Props {
  obraId: string;
  cotacao: CotacaoComPropostas;
}

/**
 * Links da cotação para o fornecedor preencher sem login (SPEC 144). O link aparece uma vez, na hora
 * de gerar: no banco fica só o hash. Cotação em cesta não gera link.
 */
export function CotacaoConvites({ obraId, cotacao }: Props) {
  const { data: convites = [] } = useConvitesCotacao(cotacao.id);
  const revogar = useRevogarConvite(cotacao.id);
  const [gerando, setGerando] = useState(false);
  const [linkGerado, setLinkGerado] = useState<{ fornecedor: string; link: string } | null>(null);

  const podeGerar = cotacao.status === "aberta" && cotacao.tipo === "item";
  if (!podeGerar && convites.length === 0) return null;

  return (
    <section aria-label="Links para fornecedores" className="rounded-lg border border-black/5 p-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium text-ink">Links para fornecedores</h3>
        <span className="text-xs text-muted-foreground">{convites.length}</span>
        {podeGerar && (
          <Button variant="outline" size="sm" className="ml-auto h-7" onClick={() => setGerando(true)}>
            Gerar link
          </Button>
        )}
      </div>

      {convites.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Gere um link e mande ao fornecedor. A proposta entra aqui quando ele responder.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-black/5">
          {convites.map((c) => {
            const estado = estadoDoConvite(c);
            return (
              <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{c.fornecedor_nome}</span>
                <StatusBadge domain="cotacao_convite" status={estado} />
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {estado === "respondido" && c.respondido_em
                    ? `em ${diaDoTimestamp(c.respondido_em)}`
                    : estado === "expirado"
                      ? `expirou em ${diaDoTimestamp(c.expira_em)}`
                      : estado === "revogado"
                        ? ""
                        : `válido até ${diaDoTimestamp(c.expira_em)}`}
                </span>
                {podeRevogarConvite(estado) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={revogar.isPending}
                    onClick={() =>
                      revogar.mutate(c.id, {
                        onSuccess: () => toast.success("Link revogado"),
                        onError: (e) => toast.error(getSafeErrorMessage(e, "Não foi possível revogar o link.")),
                      })
                    }
                  >
                    Revogar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {gerando && (
        <GerarLinkDialog
          cotacaoId={cotacao.id}
          obraId={obraId}
          onClose={() => setGerando(false)}
          onGerado={(fornecedor, link) => {
            setGerando(false);
            setLinkGerado({ fornecedor, link });
          }}
        />
      )}
      <LinkGeradoDialog gerado={linkGerado} onClose={() => setLinkGerado(null)} />
    </section>
  );
}

function GerarLinkDialog({
  cotacaoId,
  obraId,
  onClose,
  onGerado,
}: {
  cotacaoId: string;
  obraId: string;
  onClose: () => void;
  onGerado: (fornecedor: string, link: string) => void;
}) {
  const { data: fornecedores = [] } = useFornecedoresLite();
  const criar = useCriarConvite(cotacaoId, obraId);
  const [fornecedor, setFornecedor] = useState<string>("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [validade, setValidade] = useState("7");

  const novo = fornecedor === NOVO;
  const nomeOk = nomeNovo.trim().length >= 2;
  const valido = !!fornecedor && (!novo || nomeOk);

  const enviar = () =>
    criar.mutate(
      {
        fornecedorId: novo ? null : fornecedor,
        fornecedorNome: novo ? nomeNovo.trim() : null,
        validadeDias: Number(validade),
      },
      {
        onSuccess: (r) =>
          onGerado(
            novo ? nomeNovo.trim() : (fornecedores.find((f) => f.id === fornecedor)?.nome ?? "fornecedor"),
            linkDaCotacao(window.location.origin, r.token)
          ),
        onError: (e) => toast.error(getSafeErrorMessage(e, "Não foi possível gerar o link. Tente de novo.")),
      }
    );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Gerar link da cotação"
      description="O fornecedor abre o link, sem criar conta, e preenche preço, pagamento, desconto e prazo."
      size="sm"
      submitLabel="Gerar link"
      onSubmit={enviar}
      isPending={criar.isPending}
      submitDisabled={!valido}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="convite-fornecedor">Fornecedor</Label>
          <Select value={fornecedor} onValueChange={setFornecedor}>
            <SelectTrigger id="convite-fornecedor">
              <SelectValue placeholder="Escolha um fornecedor" />
            </SelectTrigger>
            <SelectContent>
              {fornecedores.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
              <SelectItem value={NOVO}>Novo fornecedor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {novo && (
          <div className="space-y-1.5">
            <Label htmlFor="convite-nome">Nome do fornecedor</Label>
            <Input
              id="convite-nome"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Depósito Santa Luzia"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="convite-validade">Validade do link</Label>
          <Select value={validade} onValueChange={setValidade}>
            <SelectTrigger id="convite-validade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALIDADES.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormDialog>
  );
}

function LinkGeradoDialog({
  gerado,
  onClose,
}: {
  gerado: { fornecedor: string; link: string } | null;
  onClose: () => void;
}) {
  const copiar = async () => {
    if (!gerado) return;
    try {
      await navigator.clipboard.writeText(gerado.link);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie à mão.");
    }
  };

  return (
    <Dialog open={!!gerado} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de {gerado?.fornecedor}</DialogTitle>
          <DialogDescription>
            Copie agora. Por segurança, o link não aparece de novo. Se perder, gere outro e revogue este.
          </DialogDescription>
        </DialogHeader>
        <Input
          readOnly
          value={gerado?.link ?? ""}
          aria-label="Link da cotação"
          onFocus={(e) => e.currentTarget.select()}
        />
        <DialogFooter>
          <Button variant="brand" onClick={copiar}>
            <Copy className="mr-1.5 h-4 w-4" />
            Copiar link
          </Button>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
