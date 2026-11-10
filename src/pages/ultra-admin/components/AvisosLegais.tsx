import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { mensagemDaFunction } from "@/lib/edgeError";
import { formatNumber } from "@/lib/format";

/**
 * Aviso legal por e-mail aos administradores (Termos v2, cláusula 15 e Anexo A5). O texto
 * vem do catálogo da edge function `aviso-legal-admins`; aqui só se escolhe qual aviso e
 * se confere antes de mandar. Reenviar não duplica: quem já recebeu fica de fora.
 */

const AVISOS = [
  {
    id: "termos-2.0",
    nome: "Termos de Uso 2.0 e Política de Privacidade 2.1",
    prazo: "Vale em 10 de dezembro de 2026 para quem já tem conta: o aviso precisa sair 30 dias antes.",
  },
] as const;

type Contagem = {
  aviso: string;
  administradores: number;
  ja_receberam: number;
  pendentes?: number;
  enviados?: number;
  falhas?: number;
};

async function chamar(aviso: string, modo: "simular" | "enviar"): Promise<Contagem> {
  const { data, error } = await supabase.functions.invoke("aviso-legal-admins", { body: { aviso, modo } });
  if (error) throw new Error(await mensagemDaFunction(error, "Não foi possível falar com o servidor. Tente de novo."));
  return data as Contagem;
}

function AvisoLinha({ aviso }: { aviso: (typeof AVISOS)[number] }) {
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const simular = useMutation({
    mutationFn: () => chamar(aviso.id, "simular"),
    onSuccess: setContagem,
    onError: (e: Error) => toast.error(e.message),
  });

  const enviar = useMutation({
    mutationFn: () => chamar(aviso.id, "enviar"),
    onSuccess: (r) => {
      setConfirmar(false);
      setContagem({ ...r, pendentes: r.falhas ?? 0 });
      if (r.falhas) {
        toast.error(`${formatNumber(r.enviados ?? 0)} enviados, ${formatNumber(r.falhas)} com falha. Envie de novo.`);
        return;
      }
      toast.success(`Aviso enviado a ${formatNumber(r.enviados ?? 0)} administradores`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendentes = contagem?.pendentes ?? null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-paper-border py-3 first:border-t-0">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-ink">{aviso.nome}</p>
        <p className="text-xs text-ink-muted">{aviso.prazo}</p>
        {contagem && (
          <p className="text-xs text-ink-soft">
            {`${formatNumber(contagem.administradores)} administradores ativos, ${formatNumber(
              contagem.ja_receberam + (contagem.enviados ?? 0)
            )} já receberam.`}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" loading={simular.isPending} onClick={() => simular.mutate()}>
          Conferir
        </Button>
        <Button
          variant="brand"
          size="sm"
          disabled={pendentes === null || pendentes === 0}
          title={pendentes === null ? "Confira antes de enviar" : undefined}
          onClick={() => setConfirmar(true)}
        >
          {pendentes ? `Enviar a ${formatNumber(pendentes)}` : "Enviar"}
        </Button>
      </div>

      <FormDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Enviar o aviso por e-mail"
        description={`Vai para ${formatNumber(pendentes ?? 0)} administradores que ainda não receberam. Não dá para desfazer.`}
        size="sm"
        submitLabel="Enviar aviso"
        isPending={enviar.isPending}
        onSubmit={() => enviar.mutate()}
      >
        <p className="text-sm text-ink-muted">{aviso.nome}</p>
      </FormDialog>
    </div>
  );
}

export function AvisosLegais() {
  return (
    <section className="space-y-1 rounded-2xl border bg-card p-4 md:p-5" aria-labelledby="avisos-legais">
      <h2 id="avisos-legais" className="text-base font-semibold text-ink">
        Avisos legais aos administradores
      </h2>
      <p className="text-sm text-ink-soft">
        Os Termos de Uso preveem aviso por e-mail antes de mudança material, reajuste ou fornecedor novo. Confira
        quantos vão receber e envie; quem já recebeu não recebe de novo.
      </p>
      <div className="pt-2">
        {AVISOS.map((a) => (
          <AvisoLinha key={a.id} aviso={a} />
        ))}
      </div>
    </section>
  );
}
