import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { usePageTitle } from "@/hooks/usePageTitle";

interface PropostaPublicaDados {
  empresa: string;
  numero: number;
  pdf: string | null;
  aceita_em: string | null;
  estado: "disponivel" | "aceita" | "substituida" | "expirada" | "encerrada";
}

const estados: Record<PropostaPublicaDados["estado"], string> = {
  disponivel: "Disponível para aceite",
  aceita: "Proposta aceita",
  substituida: "Existe uma versão mais recente. Peça o novo link ao escritório.",
  expirada: "Esta versão expirou. Fale com o escritório para solicitar uma nova proposta.",
  encerrada: "Esta versão está encerrada. Fale com o escritório se precisar de ajuda.",
};

async function acessar(token: string, acao: "abrir" | "aceitar") {
  const { data, error } = await supabase.functions.invoke<PropostaPublicaDados>("proposta-link", {
    body: { token, acao },
  });
  if (error || !data) throw new Error("Não foi possível abrir a proposta");
  return data;
}

export default function PropostaPublica() {
  usePageTitle("Proposta comercial");
  const token = useLocation().hash.slice(1);
  const [confirmando, setConfirmando] = useState(false);
  const consulta = useQuery({
    queryKey: ["proposta-compartilhada", token],
    queryFn: () => acessar(token, "abrir"),
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const aceite = useMutation({ mutationFn: () => acessar(token, "aceitar") });
  const versao = aceite.data ?? consulta.data;

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle>{versao ? `Proposta comercial · V${versao.numero}` : "Proposta comercial"}</CardTitle>
          {versao && <p className="text-sm text-muted-foreground">{versao.empresa}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {versao ? (
            <>
              <p role="status">
                {estados[versao.estado]}
                {versao.aceita_em ? ` em ${formatDateTime(versao.aceita_em)}` : ""}
              </p>
              {versao.pdf ? (
                <Button asChild variant="outline">
                  <a href={versao.pdf} rel="noreferrer" referrerPolicy="no-referrer">
                    Baixar PDF da V{versao.numero}
                  </a>
                </Button>
              ) : (
                <p>PDF temporariamente indisponível. Recarregue a página para tentar novamente.</p>
              )}
              {versao.estado === "disponivel" && versao.pdf && (
                <div className="space-y-2">
                  {confirmando && <p>Confirmar o aceite desta versão da proposta?</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="brand"
                      disabled={aceite.isPending}
                      onClick={() => {
                        if (confirmando) aceite.mutate();
                        else setConfirmando(true);
                      }}
                    >
                      {confirmando ? "Confirmar aceite" : "Aceitar proposta"}
                    </Button>
                    {confirmando && (
                      <Button variant="ghost" disabled={aceite.isPending} onClick={() => setConfirmando(false)}>
                        Voltar
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {aceite.isError && <p role="alert">Não foi possível confirmar o aceite. Tente novamente.</p>}
            </>
          ) : (
            <p role="status">
              {token && consulta.isPending ? "Abrindo proposta…" : "Proposta indisponível. Peça o link ao escritório."}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
