import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  HardHat,
  History,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Star,
  Sun,
  Sunrise,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useObras } from "@/hooks/useObras";
import { useCidadesSalvas } from "@/hooks/useCidadesSalvas";
import {
  buscarHistorico,
  buscarLocais,
  buscarPrevisao,
  climaPorCodigo,
  corTemperatura,
  diasComChuva,
  nivelUV,
  nomeDaCoordenada,
  type CategoriaClima,
  type DiaPrevisao,
  type LocalGeo,
} from "@/lib/clima";
import { toast } from "sonner";

const ICONE: Record<CategoriaClima, LucideIcon> = {
  sol: Sun,
  nuvem: Cloud,
  chuva: CloudRain,
  tempestade: CloudLightning,
  neve: CloudSnow,
  nevoa: CloudFog,
};

type Alvo = { label: string; latitude: number; longitude: number };

const LAST_KEY = "pilar.clima.ultimo";
const lerUltimo = (): Alvo | null => {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as Alvo) : null;
  } catch {
    return null;
  }
};
const perto = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
  Math.abs(a.latitude - b.latitude) < 0.02 && Math.abs(a.longitude - b.longitude) < 0.02;

const diaSemana = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
};
const diaMes = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};
const horaLabel = (iso: string) => `${iso.split("T")[1]?.slice(0, 2) ?? "--"}h`;

function Metrica({ icon: Icon, label, valor }: { icon: LucideIcon; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] leading-none text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{valor}</p>
      </div>
    </div>
  );
}

function BarraTemp({ dia, weekMin, weekMax }: { dia: DiaPrevisao; weekMin: number; weekMax: number }) {
  const span = Math.max(1, weekMax - weekMin);
  const left = ((dia.tempMin - weekMin) / span) * 100;
  const width = Math.max(10, ((dia.tempMax - dia.tempMin) / span) * 100);
  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted">
      <div
        className="absolute h-1.5 rounded-full"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          backgroundImage: `linear-gradient(to right, ${corTemperatura(dia.tempMin)}, ${corTemperatura(dia.tempMax)})`,
        }}
      />
    </div>
  );
}

/** Diálogo de adicionar cidade (busca + escolha). */
function AddCidadeDialog({
  open,
  onOpenChange,
  onEscolher,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEscolher: (l: LocalGeo) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<LocalGeo[]>([]);
  const [buscando, setBuscando] = useState(false);

  const buscar = async () => {
    if (q.trim().length < 2) return;
    setBuscando(true);
    try {
      const res = await buscarLocais(q.trim());
      if (res.length === 0) toast.error("Cidade não encontrada", { description: "Tente 'cidade, estado'." });
      setResultados(res.slice(0, 8));
    } catch {
      toast.error("Erro ao buscar a cidade");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar cidade</DialogTitle>
          <DialogDescription>Busque por cidade ou "cidade, estado" (ex.: Campos, RJ).</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Ex.: Sorocaba"
          />
          <Button variant="outline" onClick={buscar} disabled={buscando || q.trim().length < 2}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {resultados.length > 0 && (
          <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto">
            {resultados.map((l) => (
              <li key={`${l.latitude},${l.longitude}`}>
                <button
                  onClick={() => onEscolher(l)}
                  className="flex w-full items-center gap-2 px-1 py-2.5 text-left text-sm text-ink hover:bg-muted"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {l.rotulo}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ObraClimaPage() {
  usePageTitle("Clima");
  const { data: obras = [] } = useObras();
  const comLocal = useMemo(() => obras.filter((o) => o.latitude != null && o.longitude != null), [obras]);
  const { cidades, adicionar, remover, salva } = useCidadesSalvas();

  const [alvo, setAlvo] = useState<Alvo | null>(lerUltimo);
  const [modoLocal, setModoLocal] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [localizando, setLocalizando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(alvo));
    } catch {
      /* modo privado: sem persistência */
    }
  }, [alvo]);

  const selecionar = (a: Alvo) => {
    setModoLocal(false);
    setAlvo(a);
  };

  const usarMinhaLocalizacao = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Localização não disponível neste dispositivo");
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await nomeDaCoordenada(latitude, longitude);
        setAlvo({ label, latitude, longitude });
        setModoLocal(true);
        setLocalizando(false);
      },
      () => {
        toast.error("Não foi possível obter sua localização", { description: "Verifique a permissão no navegador." });
        setLocalizando(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const previsao = useQuery({
    queryKey: ["clima", alvo?.latitude, alvo?.longitude],
    enabled: !!alvo,
    staleTime: 1000 * 60 * 30,
    queryFn: () => buscarPrevisao(alvo!.latitude, alvo!.longitude),
  });
  const historico = useQuery({
    queryKey: ["clima-historico", alvo?.latitude, alvo?.longitude],
    enabled: !!alvo,
    staleTime: 1000 * 60 * 60,
    queryFn: () => buscarHistorico(alvo!.latitude, alvo!.longitude),
  });

  const dados = previsao.data;
  const chuvosos = dados ? diasComChuva(dados.dias) : [];
  const weekMin = dados ? Math.min(...dados.dias.map((d) => d.tempMin)) : 0;
  const weekMax = dados ? Math.max(...dados.dias.map((d) => d.tempMax)) : 0;
  const jaSalva = alvo ? salva(alvo) : false;

  const tabAtiva = (b: { latitude: number; longitude: number }) => !modoLocal && !!alvo && perto(alvo, b);
  const semLugares = comLocal.length === 0 && cidades.length === 0;

  return (
    <PageLayout
      header={
        <PageHeader
          title="Clima"
          primaryAction={{ label: "Adicionar cidade", onClick: () => setAddOpen(true), icon: Plus }}
        />
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {/* Abas de lugares (obras + cidades salvas) + minha localização */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-black/10">
          <button
            onClick={usarMinhaLocalizacao}
            disabled={localizando}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              modoLocal
                ? "border-brand font-medium text-ink"
                : "border-transparent text-muted-foreground hover:text-ink"
            )}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            {localizando ? "Localizando…" : "Minha localização"}
          </button>
          {comLocal.map((o) => (
            <button
              key={o.id}
              onClick={() =>
                selecionar({
                  label: o.cidade ? `${o.nome} · ${o.cidade}` : o.nome,
                  latitude: o.latitude!,
                  longitude: o.longitude!,
                })
              }
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                tabAtiva({ latitude: o.latitude!, longitude: o.longitude! })
                  ? "border-brand font-medium text-ink"
                  : "border-transparent text-muted-foreground hover:text-ink"
              )}
            >
              <HardHat className="h-3.5 w-3.5" />
              {o.nome}
            </button>
          ))}
          {cidades.map((c) => (
            <span
              key={`${c.latitude},${c.longitude}`}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 pl-3 pr-1.5 py-2 text-sm transition-colors",
                tabAtiva(c) ? "border-brand font-medium text-ink" : "border-transparent text-muted-foreground"
              )}
            >
              <button onClick={() => selecionar(c)} className="inline-flex items-center gap-1.5 hover:text-ink">
                <MapPin className="h-3.5 w-3.5" />
                {c.label}
              </button>
              <button
                onClick={() => remover(c)}
                aria-label={`Remover ${c.label}`}
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {!alvo ? (
          <EmptyState
            icon={Sun}
            title={semLugares ? "Nenhum lugar ainda" : "Escolha um lugar acima"}
            description={
              semLugares
                ? "Use sua localização, ou toque em Adicionar cidade no topo para acompanhar o clima."
                : "Selecione uma obra, sua localização ou uma cidade salva para ver a previsão."
            }
            action={{ label: "Adicionar cidade", onClick: () => setAddOpen(true) }}
          />
        ) : previsao.isLoading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : previsao.isError || !dados ? (
          <EmptyState icon={Cloud} title="Não foi possível obter o clima" description="Tente novamente em instantes." />
        ) : (
          <div className="space-y-4">
            {/* Alerta de chuva no topo: é o que pede ação */}
            {chuvosos.length > 0 && (
              <div className="rounded-2xl border border-attention-soft bg-attention-soft/40 px-4 py-3 text-sm text-attention-strong">
                <span className="font-medium">Chuva prevista:</span>{" "}
                {chuvosos
                  .slice(0, 6)
                  .map((d) => `${diaSemana(d.data)} ${diaMes(d.data)}`)
                  .join(", ")}
                . Planeje serviços sensíveis (concretagem, pintura externa, içamento).
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {alvo.label}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (jaSalva ? remover(alvo) : adicionar(alvo))}
                className="text-muted-foreground"
              >
                <Star className={jaSalva ? "mr-1.5 h-4 w-4 fill-brand text-brand" : "mr-1.5 h-4 w-4"} />
                {jaSalva ? "Salva" : "Salvar"}
              </Button>
            </div>

            {/* Condição atual */}
            {(() => {
              const info = climaPorCodigo(dados.atual.code);
              const Icone = ICONE[info.categoria];
              const hoje = dados.dias[0];
              return (
                <Card className="rounded-2xl border border-black/5 bg-white">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center gap-4">
                      <Icone className="h-14 w-14 text-brand" />
                      <div>
                        <p className="text-4xl font-semibold tabular-nums text-ink">{dados.atual.temp}°C</p>
                        <p className="text-sm text-muted-foreground">
                          {info.label} · sensação {dados.atual.sensacao}°C
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      <Metrica icon={Droplets} label="Umidade" valor={`${dados.atual.umidade}%`} />
                      <Metrica icon={Wind} label="Vento" valor={`${dados.atual.vento} km/h ${dados.atual.direcao}`} />
                      <Metrica icon={Wind} label="Rajada" valor={`${dados.atual.rajada} km/h`} />
                      <Metrica icon={CloudRain} label="Precipitação" valor={`${dados.atual.precipitacao} mm`} />
                      {hoje && <Metrica icon={Sun} label="UV (máx)" valor={`${hoje.uvMax} · ${nivelUV(hoje.uvMax)}`} />}
                      {hoje?.nascer && hoje?.ocaso && (
                        <Metrica
                          icon={Sunrise}
                          label="Sol"
                          valor={`${horaLabel(hoje.nascer)}–${horaLabel(hoje.ocaso)}`}
                        />
                      )}
                    </div>
                    {historico.data && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <History className="h-3.5 w-3.5" />
                        Últimos {historico.data.totalDias} dias:{" "}
                        {historico.data.diasChuva === 0
                          ? "sem chuva registrada"
                          : `choveu em ${historico.data.diasChuva} dia${historico.data.diasChuva > 1 ? "s" : ""} · ${historico.data.chuvaMm} mm`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* 48 horas */}
            {dados.horas.length > 0 && (
              <Card className="rounded-2xl border border-black/5 bg-white">
                <CardContent className="space-y-2 p-4">
                  <h3 className="text-sm font-medium text-ink">Próximas 48 horas</h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {dados.horas.map((h, i) => {
                      const Icone = ICONE[climaPorCodigo(h.code).categoria];
                      const prev = dados.horas[i - 1];
                      const novoDia = !!prev && h.hora.slice(0, 10) !== prev.hora.slice(0, 10);
                      return (
                        <Fragment key={h.hora}>
                          {novoDia && (
                            <div className="flex min-w-[3rem] flex-col items-center justify-center gap-0.5 border-l border-black/10 pl-2 text-center">
                              <span className="text-[11px] font-medium capitalize text-ink">
                                {diaSemana(h.hora.slice(0, 10))}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{diaMes(h.hora.slice(0, 10))}</span>
                            </div>
                          )}
                          <div className="flex min-w-[3.25rem] flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {i === 0 ? "Agora" : horaLabel(h.hora)}
                            </span>
                            <Icone className="h-5 w-5 text-ink/70" />
                            <span className="text-sm font-medium tabular-nums text-ink">{h.temp}°</span>
                            {h.chuvaProb > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-info-strong">
                                <Droplets className="h-3 w-3" />
                                {h.chuvaProb}%
                              </span>
                            )}
                            {h.chuvaMm > 0 && (
                              <span className="text-[10px] tabular-nums text-muted-foreground">{h.chuvaMm} mm</span>
                            )}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 16 dias */}
            <Card className="rounded-2xl border border-black/5 bg-white">
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-medium text-ink">Próximos 16 dias</h3>
                <ul className="divide-y divide-black/5">
                  {dados.dias.map((d) => {
                    const info = climaPorCodigo(d.code);
                    const Icone = ICONE[info.categoria];
                    return (
                      <li key={d.data} className="flex items-center gap-3 py-2">
                        <span className="w-24 shrink-0 whitespace-nowrap text-sm capitalize text-ink">
                          {diaSemana(d.data)} <span className="text-xs text-muted-foreground">{diaMes(d.data)}</span>
                        </span>
                        <Icone className="h-5 w-5 shrink-0 text-ink/70" aria-label={info.label} />
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {d.tempMin}°
                        </span>
                        <div className="min-w-0 flex-1">
                          <BarraTemp dia={d} weekMin={weekMin} weekMax={weekMax} />
                        </div>
                        <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-ink">{d.tempMax}°</span>
                        <span className="inline-flex w-12 shrink-0 items-center justify-end gap-1 text-xs text-info-strong">
                          {d.chuvaProb > 0 && (
                            <>
                              <Droplets className="h-3 w-3" />
                              {d.chuvaProb}%
                            </>
                          )}
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {d.chuvaMm > 0 ? `${d.chuvaMm} mm` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AddCidadeDialog
        key={String(addOpen)}
        open={addOpen}
        onOpenChange={setAddOpen}
        onEscolher={(l) => {
          const a = { label: l.rotulo, latitude: l.latitude, longitude: l.longitude };
          adicionar(a);
          selecionar(a);
          setAddOpen(false);
        }}
      />
    </PageLayout>
  );
}
