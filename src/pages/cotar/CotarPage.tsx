import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { formatDate } from "@/lib/format";
import { diaDoTimestamp } from "@/lib/cotacaoConvite";
import { formatValorToInput } from "@/lib/currencyUtils";
import { consultarCotacao, enviarProposta, type CotacaoPublica } from "./cotarApi";
import { lerProposta, type CamposProposta, type ErrosProposta } from "./cotarSchema";

const VAZIOS: CamposProposta = {
  valor: "",
  valorParcelado: "",
  condicao: "",
  desconto: "",
  prazo: "",
  observacoes: "",
};

const aPartirDaResposta = (r: NonNullable<CotacaoPublica["resposta_atual"]>): CamposProposta => ({
  valor: r.valor != null ? formatValorToInput(r.valor) : "",
  valorParcelado: r.valor_parcelado != null ? formatValorToInput(r.valor_parcelado) : "",
  condicao: r.condicao_pagamento ?? "",
  desconto: r.desconto_pct != null ? String(r.desconto_pct).replace(".", ",") : "",
  prazo: r.prazo_entrega_dias != null ? String(r.prazo_entrega_dias) : "",
  observacoes: r.observacoes ?? "",
});

/** Página pública de cotação (SPEC 144): o fornecedor preenche preço e prazo, sem login. */
export default function CotarPage() {
  const { token = "" } = useParams<{ token: string }>();

  // Página com segredo na URL: fora do buscador e sem mandar o endereço adiante.
  useEffect(() => {
    const titulo = document.title;
    document.title = "Cotação";
    const metas = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const m = document.createElement("meta");
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
      return m;
    });
    return () => {
      document.title = titulo;
      metas.forEach((m) => m.remove());
    };
  }, []);

  const cotacao = useQuery({
    queryKey: ["cotar", token],
    queryFn: () => consultarCotacao(token),
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        {cotacao.isPending ? (
          <PageLoader size="section" label="Abrindo a cotação" />
        ) : cotacao.isError ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                title="Não foi possível abrir a cotação"
                description="Confira sua conexão e tente de novo."
                action={{ label: "Tentar de novo", variant: "outline", onClick: () => cotacao.refetch() }}
              />
            </CardContent>
          </Card>
        ) : cotacao.data === null ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                title="Esta cotação foi encerrada"
                description="Fale com quem enviou o link se ainda quiser mandar uma proposta."
              />
            </CardContent>
          </Card>
        ) : (
          <Formulario token={token} cotacao={cotacao.data} onEncerrada={() => cotacao.refetch()} />
        )}
      </div>
    </main>
  );
}

function Formulario({
  token,
  cotacao,
  onEncerrada,
}: {
  token: string;
  cotacao: CotacaoPublica;
  onEncerrada: () => void;
}) {
  const [campos, setCampos] = useState<CamposProposta>(
    cotacao.resposta_atual ? aPartirDaResposta(cotacao.resposta_atual) : VAZIOS
  );
  const [erros, setErros] = useState<ErrosProposta>({});
  const [enviado, setEnviado] = useState(false);

  const enviar = useMutation({
    mutationFn: (dados: Parameters<typeof enviarProposta>[1]) => enviarProposta(token, dados),
    onSuccess: (guardou) => (guardou ? setEnviado(true) : onEncerrada()),
    onError: (e: Error) => toast.error(e.message || "Não foi possível enviar a proposta. Tente de novo."),
  });

  const mudar = (campo: keyof CamposProposta) => (valor: string) => {
    setCampos((c) => ({ ...c, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  };

  const validade = cotacao.expira_em ? diaDoTimestamp(cotacao.expira_em) : null;
  const detalhe = [
    cotacao.quantidade != null && `${cotacao.quantidade}${cotacao.unidade ? ` ${cotacao.unidade}` : ""}`,
    cotacao.prazo_necessidade && `necessário até ${formatDate(cotacao.prazo_necessidade)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (enviado) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <h1 className="text-lg font-semibold">Proposta enviada</h1>
          <p className="text-sm text-muted-foreground">
            {cotacao.empresa_nome ?? "A empresa"} recebeu seus valores.
            {validade ? ` Você pode corrigir pelo mesmo link até ${validade}.` : ""}
          </p>
          <Button variant="outline" onClick={() => setEnviado(false)}>
            Corrigir proposta
          </Button>
        </CardContent>
      </Card>
    );
  }

  const submeter = (ev: React.FormEvent) => {
    ev.preventDefault();
    const r = lerProposta(campos);
    if (!r.ok) {
      setErros(r.erros);
      return;
    }
    enviar.mutate(r.dados);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Cotação de <b className="text-ink">{cotacao.empresa_nome ?? "uma empresa"}</b>
      </p>
      <Card>
        <CardContent className="space-y-1 p-4">
          <h1 className="text-base font-semibold">{cotacao.descricao}</h1>
          {detalhe && <p className="text-sm text-muted-foreground">{detalhe}</p>}
          {cotacao.observacoes && <p className="pt-1 text-sm">{cotacao.observacoes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={submeter} noValidate className="space-y-3">
            <h2 className="text-sm font-semibold">Sua proposta</h2>
            <Campo id="valor" rotulo="Valor à vista (R$)" erro={erros.valor}>
              <MoneyInput id="valor" value={campos.valor} onChange={mudar("valor")} aria-invalid={!!erros.valor} />
            </Campo>
            <Campo id="parcelado" rotulo="Valor parcelado (R$, opcional)" erro={erros.valorParcelado}>
              <MoneyInput id="parcelado" value={campos.valorParcelado} onChange={mudar("valorParcelado")} />
            </Campo>
            <Campo id="condicao" rotulo="Condição de pagamento" erro={erros.condicao}>
              <Input
                id="condicao"
                value={campos.condicao}
                onChange={(e) => mudar("condicao")(e.target.value)}
                maxLength={200}
                placeholder="Ex.: 30 dias"
                aria-invalid={!!erros.condicao}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo id="desconto" rotulo="Desconto (%, opcional)" erro={erros.desconto}>
                <Input
                  id="desconto"
                  inputMode="decimal"
                  value={campos.desconto}
                  onChange={(e) => mudar("desconto")(e.target.value)}
                  placeholder="3"
                  aria-invalid={!!erros.desconto}
                />
              </Campo>
              <Campo id="prazo" rotulo="Prazo de entrega (dias)" erro={erros.prazo}>
                <Input
                  id="prazo"
                  inputMode="numeric"
                  value={campos.prazo}
                  onChange={(e) => mudar("prazo")(e.target.value)}
                  placeholder="5"
                  aria-invalid={!!erros.prazo}
                />
              </Campo>
            </div>
            <Campo id="observacoes" rotulo="Observações (opcional)" erro={erros.observacoes}>
              <Input
                id="observacoes"
                value={campos.observacoes}
                onChange={(e) => mudar("observacoes")(e.target.value)}
                maxLength={1000}
                placeholder="Frete incluso, validade da proposta..."
              />
            </Campo>
            <Button type="submit" variant="brand" className="w-full" loading={enviar.isPending}>
              Enviar proposta
            </Button>
            {validade && (
              <p className="text-xs text-muted-foreground">
                Link válido até {validade}. Você pode corrigir a proposta até lá.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({
  id,
  rotulo,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erro && (
        <p role="alert" className="text-xs text-danger-strong">
          {erro}
        </p>
      )}
    </div>
  );
}
