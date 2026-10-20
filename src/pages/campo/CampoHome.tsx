import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  CloudOff,
  HardHat,
  LogOut,
  Mic,
  Pencil,
  RefreshCw,
  Ruler,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { climaLabel } from "@/lib/obras";
import { dataLocalIso, rotuloDoDia } from "@/lib/registrosObra";
import { usePageTitle } from "@/hooks/usePageTitle";
import { novoItemDeRegistro } from "./campoRegistroFila";
import { comprimirFoto } from "./fotoCampo";
import { RegistroCardCampo } from "./RegistroCardCampo";
import { agruparPorDia, montarRegistrosView } from "./registrosView";
import { campoLogout, getCampoToken, type CampoAccount } from "./useCampoAuth";
import { useCampoSync } from "./useCampoSync";
import { useRegistrosCampo } from "./useRegistrosCampo";

import { BusyMark } from "@/components/motion/BusyMark";

interface RdoDia {
  id: string;
  data: string;
  clima: string | null;
  efetivo: number | null;
  atividades: string | null;
  fotos?: number;
  medicoes?: number;
  tarefas?: number;
}

export default function CampoHome() {
  usePageTitle("Pilar Campo");
  const navigate = useNavigate();
  const { account } = useOutletContext<{ account: CampoAccount }>();
  const { pendentes, locais, sincronizando, sincronizar, registrar, descartarRegistro } = useCampoSync();
  const {
    servidor,
    isLoading: carregandoRegistros,
    reprocessar,
    responderEfetivo,
  } = useRegistrosCampo(account.account_id);
  const registros = useMemo(
    () => montarRegistrosView(servidor, locais, account.nome),
    [servidor, locais, account.nome]
  );
  const dias = useMemo(() => agruparPorDia(registros), [registros]);

  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState("");
  const entradaFoto = useRef<HTMLInputElement>(null);

  const enviarTexto = async () => {
    const t = texto.trim();
    if (!t) return;
    await registrar(novoItemDeRegistro({ data: dataLocalIso(), texto: t, fotos: [], aceiteAudio: false }));
    setTexto("");
    setEscrevendo(false);
  };

  const enviarFoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await comprimirFoto(file);
      await registrar(
        novoItemDeRegistro({ data: dataLocalIso(), fotos: [{ blob, contentType: "image/jpeg" }], aceiteAudio: false })
      );
    } catch {
      toast.error("Não deu para usar essa foto", { description: "Tire outra." });
    }
  };

  const { data: rdos = [], isLoading } = useQuery({
    queryKey: ["campo_rdos", account.account_id],
    queryFn: async (): Promise<RdoDia[]> => {
      const token = getCampoToken();
      if (!token) return [];
      const { data, error } = await supabase.rpc("campo_listar_rdos", { p_token: token, p_limite: 30 });
      if (error) throw error;
      const r = data as unknown as { ok: boolean; rdos?: RdoDia[] };
      return r?.ok ? (r.rdos ?? []) : [];
    },
    staleTime: 1000 * 30,
  });

  const sair = () => {
    campoLogout();
    navigate("/campo/login", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-ink">
            <HardHat className="h-4 w-4" />
          </div>
          <span className="font-semibold text-ink">Pilar Campo</span>
        </div>
        <Button variant="ghost" size="sm" onClick={sair} className="text-muted-foreground">
          <LogOut className="mr-1.5 h-4 w-4" />
          Sair
        </Button>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <h1 className="text-2xl font-semibold text-ink">{account.nome}</h1>
        </div>

        {pendentes > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-warning-soft bg-warning-soft/40 px-4 py-3">
            <CloudOff className="h-5 w-5 shrink-0 text-warning-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {pendentes} {pendentes === 1 ? "item aguardando" : "itens aguardando"} envio
              </p>
              <p className="text-xs text-muted-foreground">Salvo no aparelho. Envia sozinho com internet.</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={sincronizar}
              disabled={sincronizando}
              aria-label="Tentar enviar agora"
            >
              {sincronizando ? <BusyMark className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => navigate("/campo/gravar")}
            className="flex w-full items-center gap-4 rounded-[28px] bg-ink px-5 py-5 text-left shadow-[0_16px_36px_-16px_rgba(26,26,26,0.6)] active:scale-[0.99]"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
              <Mic className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="space-y-1">
              <span className="block text-xl font-semibold text-background">Gravar o que foi feito</span>
              <span className="block text-sm text-background/70">Fale do seu jeito. A gente organiza.</span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              ref={entradaFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                void enviarFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-semibold"
              onClick={() => entradaFoto.current?.click()}
            >
              <Camera className="mr-2 h-5 w-5" aria-hidden="true" />
              Foto
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-semibold"
              onClick={() => setEscrevendo(true)}
            >
              <Pencil className="mr-2 h-5 w-5" aria-hidden="true" />
              Escrever
            </Button>
          </div>
        </div>

        <section className="space-y-4" aria-labelledby="registros-titulo">
          <h2 id="registros-titulo" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Registros da obra
          </h2>
          {carregandoRegistros && registros.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : registros.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center">
              <Mic className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Nenhum registro ainda. Aperte em "Gravar o que foi feito" e fale.
              </p>
            </div>
          ) : (
            dias.map((d) => (
              <div key={d.data} className="space-y-2">
                <p className="text-sm font-semibold text-ink">{rotuloDoDia(d.data)}</p>
                {d.registros.map((r) => (
                  <RegistroCardCampo
                    key={r.chave}
                    registro={r}
                    onReprocessar={(id) => reprocessar.mutate(id)}
                    reprocessando={reprocessar.isPending && reprocessar.variables === r.id}
                    onResponderEfetivo={(id, quantidade) =>
                      responderEfetivo.mutate(
                        { registroId: id, quantidade },
                        { onError: () => toast.error("Não deu para salvar", { description: "Tente de novo." }) }
                      )
                    }
                    onDescartar={(chave) => void descartarRegistro(chave)}
                  />
                ))}
              </div>
            ))
          )}
        </section>

        <Button
          variant="outline"
          className="h-12 w-full justify-start rounded-2xl text-base"
          onClick={() => navigate("/campo/dia")}
        >
          <ClipboardList className="mr-2 h-5 w-5" aria-hidden="true" />
          Registrar o dia (formulário)
        </Button>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Últimos dias (formulário)
          </p>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : rdos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum dia registrado ainda.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rdos.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{formatDate(r.data)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {r.clima && <span>{climaLabel(r.clima)}</span>}
                      {r.efetivo != null && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {r.efetivo}
                        </span>
                      )}
                      {!!r.fotos && r.fotos > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {r.fotos}
                        </span>
                      )}
                      {!!r.medicoes && r.medicoes > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          {r.medicoes}
                        </span>
                      )}
                      {!!r.tarefas && r.tarefas > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" />
                          {r.tarefas}
                        </span>
                      )}
                      {r.atividades && <span className="truncate">{r.atividades}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Seu acesso é só desta obra. O que você registrar aqui aparece para o escritório.
        </p>
      </main>

      <FormDialog
        open={escrevendo}
        onOpenChange={setEscrevendo}
        size="sm"
        title="Escrever um registro"
        submitLabel="Enviar"
        submitDisabled={texto.trim().length === 0}
        onSubmit={() => void enviarTexto()}
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={5000}
          rows={5}
          autoFocus
          aria-label="O que foi feito"
          placeholder="Ex.: Terminei a parede da cozinha do 203. Falta a do banheiro."
        />
      </FormDialog>
    </div>
  );
}
