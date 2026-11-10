import { useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PilarPage } from "@/components/PilarPage";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader } from "@/components/motion/PageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/lib/format";
import { FEATURES } from "@/lib/features";
import { IMPACTOS, type Impacto } from "@/lib/novidades";
import { statusLabel } from "@/lib/status";
import {
  ordenarReleases,
  useExcluirItem,
  useExcluirRelease,
  usePublicarRelease,
  useReleasesAdmin,
  useSalvarItem,
  useSalvarRelease,
  type ItemForm,
  type ReleaseAdmin,
  type ReleaseItemAdmin,
} from "./releases";

const TODOS = "todos";
const MODULOS = FEATURES.filter((f) => !f.dormant && !f.parent);
const labelModulo = (key: string | null) => MODULOS.find((f) => f.key === key)?.label ?? key;

const DICA_IMPACTO: Record<Impacto, string> = {
  fluxo: 'Abre o modal "O que mudou" depois do recarregar.',
  melhoria: "Acende o ponto em Novidades.",
  correcao: "Só entra na lista de Novidades.",
};

type EdicaoItem = { release: ReleaseAdmin; item: ReleaseItemAdmin | null };

// Releases do produto (SPEC 152): o rascunho nasce das linhas `Novidade:` dos commits no deploy em
// produção; aqui o texto é revisado e a release publicada. Publicar avisa quem pediu cada item.
export default function Releases() {
  usePageTitle("Releases · Ultra admin");
  const query = useReleasesAdmin();
  const salvarRelease = useSalvarRelease();
  const excluirRelease = useExcluirRelease();
  const salvarItem = useSalvarItem();
  const excluirItem = useExcluirItem();
  const publicar = usePublicarRelease();

  const [releaseForm, setReleaseForm] = useState<{ id: string | null; titulo: string; versao: string } | null>(null);
  const [itemEdicao, setItemEdicao] = useState<EdicaoItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>({ texto: "", impacto: "melhoria", modulo: null });
  const [publicarAlvo, setPublicarAlvo] = useState<ReleaseAdmin | null>(null);
  const [excluirReleaseAlvo, setExcluirReleaseAlvo] = useState<ReleaseAdmin | null>(null);
  const [excluirItemAlvo, setExcluirItemAlvo] = useState<ReleaseItemAdmin | null>(null);

  const erro = (e: Error) => toast.error("Não foi possível salvar", { description: e.message });

  const abrirItem = (release: ReleaseAdmin, item: ReleaseItemAdmin | null) => {
    setItemEdicao({ release, item });
    setItemForm(
      item
        ? { texto: item.texto, impacto: item.impacto, modulo: item.modulo }
        : { texto: "", impacto: "melhoria", modulo: null }
    );
  };

  const releases = ordenarReleases(query.data ?? []);

  return (
    <PilarPage
      title="Releases"
      primaryAction={{
        label: "Nova release",
        icon: Plus,
        onClick: () => setReleaseForm({ id: null, titulo: "", versao: "" }),
      }}
    >
      <p className="text-sm text-ink-muted">
        Cada release em produção chega como rascunho com as linhas <code>Novidade:</code> dos commits. Revise o texto
        com a voz do cliente e publique: só então ela aparece em Novidades. Mudança de caminho abre o modal; melhoria
        acende o ponto; correção só entra na lista.
      </p>

      {query.isLoading ? (
        <PageLoader label="Buscando releases" />
      ) : query.error ? (
        <EmptyState
          title="Não foi possível carregar as releases"
          description="Recarregue a página para tentar de novo."
        />
      ) : releases.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma release ainda"
          description="O próximo deploy em produção com linhas Novidade: nos commits cria o primeiro rascunho."
        />
      ) : (
        <div className="space-y-4">
          {releases.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-ink">{r.titulo}</h2>
                    {r.versao && <span className="text-sm text-ink-muted">{r.versao}</span>}
                    <StatusBadge domain="release" status={r.publicadaEm ? "publicada" : "rascunho"} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {r.publicadaEm
                      ? `Publicada em ${formatDateTime(r.publicadaEm)}`
                      : `Criada em ${formatDateTime(r.criadaEm)}`}
                    {r.sha && <span className="font-mono">{` · ${r.sha.slice(0, 7)}`}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReleaseForm({ id: r.id, titulo: r.titulo, versao: r.versao ?? "" })}
                  >
                    Editar
                  </Button>
                  {!r.publicadaEm && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setExcluirReleaseAlvo(r)}>
                        Excluir
                      </Button>
                      <Button
                        variant="brand"
                        size="sm"
                        disabled={r.itens.length === 0}
                        title={r.itens.length === 0 ? "Adicione ao menos um item" : undefined}
                        onClick={() => setPublicarAlvo(r)}
                      >
                        Publicar
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.itens.length === 0 ? (
                  <EmptyState compact title="Sem itens. Adicione o que o cliente precisa saber." />
                ) : (
                  <ul className="divide-y divide-black/5">
                    {r.itens.map((i) => (
                      <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm text-ink">{i.texto}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                            <StatusBadge domain="novidade" status={i.impacto} />
                            {i.modulo && <span>{labelModulo(i.modulo)}</span>}
                            {i.feedbackIds.length > 0 && (
                              <span>
                                {i.feedbackIds.length === 1
                                  ? "1 feedback ligado"
                                  : `${i.feedbackIds.length} feedbacks ligados`}
                              </span>
                            )}
                            {i.commitSha && <span className="font-mono">{i.commitSha.slice(0, 7)}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon" aria-label="Editar item" onClick={() => abrirItem(r, i)}>
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover item"
                            onClick={() => setExcluirItemAlvo(i)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" onClick={() => abrirItem(r, null)}>
                  <Plus size={14} aria-hidden /> Adicionar item
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormDialog
        open={!!releaseForm}
        onOpenChange={(o) => !o && setReleaseForm(null)}
        title={releaseForm?.id ? "Editar release" : "Nova release"}
        description={releaseForm?.id ? undefined : "Para anunciar algo que não veio de commit. Nasce como rascunho."}
        size="sm"
        isPending={salvarRelease.isPending}
        submitDisabled={!releaseForm?.titulo.trim()}
        onSubmit={() =>
          releaseForm &&
          salvarRelease.mutate(
            { id: releaseForm.id, form: releaseForm },
            { onSuccess: () => setReleaseForm(null), onError: erro }
          )
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="release-titulo">Título</Label>
            <Input
              id="release-titulo"
              value={releaseForm?.titulo ?? ""}
              maxLength={120}
              onChange={(e) => setReleaseForm((f) => f && { ...f, titulo: e.target.value })}
              placeholder="Ex.: Atualização de 10 de novembro"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="release-versao">Versão (opcional)</Label>
            <Input
              id="release-versao"
              value={releaseForm?.versao ?? ""}
              maxLength={20}
              onChange={(e) => setReleaseForm((f) => f && { ...f, versao: e.target.value })}
              placeholder="Ex.: 2.4"
            />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={!!itemEdicao}
        onOpenChange={(o) => !o && setItemEdicao(null)}
        title={itemEdicao?.item ? "Editar item" : "Novo item"}
        description="Escreva o que o cliente ganha, não o que o time fez."
        isPending={salvarItem.isPending}
        submitDisabled={!itemForm.texto.trim()}
        onSubmit={() =>
          itemEdicao &&
          salvarItem.mutate(
            {
              releaseId: itemEdicao.release.id,
              itemId: itemEdicao.item?.id ?? null,
              ordem: itemEdicao.item?.ordem ?? itemEdicao.release.itens.length,
              form: itemForm,
            },
            { onSuccess: () => setItemEdicao(null), onError: erro }
          )
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-texto">Texto para o cliente</Label>
            <Textarea
              id="item-texto"
              value={itemForm.texto}
              maxLength={300}
              rows={3}
              onChange={(e) => setItemForm((f) => ({ ...f, texto: e.target.value }))}
              placeholder="Ex.: Agora você emite a fatura de dentro do projeto"
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Impacto</Label>
              <Select
                value={itemForm.impacto}
                onValueChange={(v) => setItemForm((f) => ({ ...f, impacto: v as Impacto }))}
              >
                <SelectTrigger aria-label="Impacto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACTOS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {statusLabel("novidade", i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">{DICA_IMPACTO[itemForm.impacto]}</p>
            </div>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select
                value={itemForm.modulo ?? TODOS}
                onValueChange={(v) => setItemForm((f) => ({ ...f, modulo: v === TODOS ? null : v }))}
              >
                <SelectTrigger aria-label="Módulo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {MODULOS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-ink-muted">Só quem acessa o módulo recebe o destaque.</p>
            </div>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!publicarAlvo}
        onOpenChange={(o) => !o && setPublicarAlvo(null)}
        title={`Publicar ${publicarAlvo?.titulo ?? ""}`}
        description="A release aparece em Novidades para todos os escritórios, e quem pediu algum item recebe um aviso no sino. Publicar não dá para desfazer."
        confirmText="Publicar"
        loading={publicar.isPending}
        onConfirm={() =>
          publicarAlvo &&
          publicar.mutate(publicarAlvo.id, {
            onSuccess: (avisos) => {
              toast.success("Release publicada", {
                description:
                  avisos > 0
                    ? `${avisos === 1 ? "1 pessoa avisada" : `${avisos} pessoas avisadas`} de que o pedido saiu.`
                    : undefined,
              });
              setPublicarAlvo(null);
            },
            onError: (e: Error) => toast.error("Não foi possível publicar", { description: e.message }),
          })
        }
      />

      <ConfirmDialog
        open={!!excluirReleaseAlvo}
        onOpenChange={(o) => !o && setExcluirReleaseAlvo(null)}
        title="Excluir rascunho"
        itemName={excluirReleaseAlvo?.titulo}
        description="O rascunho e os itens somem. Os commits continuam no histórico."
        variant="destructive"
        confirmText="Excluir"
        loading={excluirRelease.isPending}
        onConfirm={() =>
          excluirReleaseAlvo &&
          excluirRelease.mutate(excluirReleaseAlvo.id, {
            onSuccess: () => setExcluirReleaseAlvo(null),
            onError: erro,
          })
        }
      />

      <ConfirmDialog
        open={!!excluirItemAlvo}
        onOpenChange={(o) => !o && setExcluirItemAlvo(null)}
        title="Remover item"
        itemName={excluirItemAlvo?.texto}
        description="O item sai da release."
        variant="destructive"
        confirmText="Remover"
        loading={excluirItem.isPending}
        onConfirm={() =>
          excluirItemAlvo &&
          excluirItem.mutate(excluirItemAlvo.id, { onSuccess: () => setExcluirItemAlvo(null), onError: erro })
        }
      />
    </PilarPage>
  );
}
