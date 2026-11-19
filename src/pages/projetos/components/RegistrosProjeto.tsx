import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useFornecedoresLite } from "@/hooks/useFornecedorDetalhe";
import { NovoAditivoProjeto, type DisciplinaAditivo } from "./AditivoProjetoDialogs";
import { useOrigensAditivos } from "../hooks/useAditivosProjeto";

type TipoAtividade = "visita" | "suporte";
type Opcao = { id: string; nome: string };

const CAMPOS = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function RegistrosProjeto({
  projetoId,
  pessoas,
  disciplinas,
  canEdit,
  podeCriarAditivo,
}: {
  projetoId: string;
  pessoas: Opcao[];
  disciplinas: DisciplinaAditivo[];
  canEdit: boolean;
  podeCriarAditivo: boolean;
}) {
  const [novo, setNovo] = useState<TipoAtividade | null>(null);
  const [aditivo, setAditivo] = useState<{ id: string; resumo: string; disciplina?: string } | null>(null);
  const { data: registros = [], isError } = useQuery({
    queryKey: ["atividade-projeto-registros", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_registros")
        .select("id, tipo, ocorrido_em, disciplina_id, detalhe, dados")
        .eq("projeto_id", projetoId)
        .in("tipo", ["visita", "suporte"])
        .order("ocorrido_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const { data: aditivos = [] } = useOrigensAditivos(projetoId, registros.length > 0);

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setNovo("visita")}>
            Registrar visita
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNovo("suporte")}>
            Registrar suporte
          </Button>
        </div>
      )}
      {isError && (
        <p role="alert" className="text-sm text-muted-foreground">
          Não foi possível carregar visitas e suporte.
        </p>
      )}
      {!!registros.length && (
        <ul aria-label="Visitas e suporte" className="divide-y rounded-md border px-3">
          {registros.map((r) => {
            const dados = r.dados as { resultado?: string; avaliar_cobranca?: boolean };
            const vinculados = aditivos.filter((a) => a.origem.atividade_id === r.id);
            return (
              <li key={r.id} className="space-y-1 py-2 text-sm">
                <p className="font-medium">
                  {r.tipo === "visita" ? "Visita" : "Suporte"} · {r.detalhe}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.ocorrido_em)}
                  {dados.resultado && ` · ${dados.resultado}`}
                </p>
                {vinculados.map((a) => (
                  <p key={a.id} className="text-xs">
                    Aditivo · {a.titulo}
                  </p>
                ))}
                {podeCriarAditivo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAditivo({
                        id: r.id,
                        resumo: r.detalhe,
                        disciplina: r.disciplina_id ?? undefined,
                      })
                    }
                  >
                    {dados.avaliar_cobranca ? "Avaliar e criar aditivo" : "Criar aditivo"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {novo && (
        <RegistroDialog
          projetoId={projetoId}
          tipo={novo}
          pessoas={pessoas}
          disciplinas={disciplinas}
          fechar={() => setNovo(null)}
        />
      )}
      {aditivo && (
        <NovoAditivoProjeto
          projetoId={projetoId}
          disciplinas={disciplinas}
          origem={{ registroId: aditivo.id, descricao: aditivo.resumo, disciplinaId: aditivo.disciplina }}
          fechar={() => setAditivo(null)}
        />
      )}
    </div>
  );
}

function RegistroDialog({
  projetoId,
  tipo,
  pessoas,
  disciplinas,
  fechar,
}: {
  projetoId: string;
  tipo: TipoAtividade;
  pessoas: Opcao[];
  disciplinas: Opcao[];
  fechar: () => void;
}) {
  const titulo = tipo === "visita" ? "Registrar visita" : "Registrar suporte";
  const { data: fornecedores = [] } = useFornecedoresLite();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    data: "",
    resumo: "",
    resultado: "",
    responsavel: "",
    disciplina: "",
    fornecedor: "",
    local: "",
    proximo: "",
    anexo: "",
    duracao: "",
    avaliar: false,
  });
  const alterar = (campo: keyof typeof form, valor: string | boolean) =>
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rpc_registrar_atividade_projeto", {
        p_projeto: projetoId,
        p_tipo: tipo,
        p_ocorrido: new Date(form.data).toISOString(),
        p_resumo: form.resumo,
        p_resultado: form.resultado,
        p_responsavel: form.responsavel || undefined,
        p_disciplina: form.disciplina || undefined,
        p_fornecedor: form.fornecedor || undefined,
        p_local_canal: form.local || undefined,
        p_proximo_passo: form.proximo || undefined,
        p_anexo: form.anexo.trim() || undefined,
        p_duracao: form.duracao ? Number(form.duracao) : undefined,
        p_avaliar_cobranca: form.avaliar,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["atividade-projeto-registros", projetoId] });
      void qc.invalidateQueries({ queryKey: ["projeto-timeline", projetoId] });
      toast.success(tipo === "visita" ? "Visita registrada" : "Suporte registrado");
      fechar();
    },
    onError: (error) => toast.error(getSafeErrorMessage(error, "Não foi possível registrar a atividade.")),
  });

  return (
    <FormDialog
      open
      title={titulo}
      description="O registro fica disponível no histórico interno do projeto."
      onOpenChange={(open) => !open && fechar()}
      onSubmit={() => salvar.mutate()}
      isPending={salvar.isPending}
      submitDisabled={!form.data || !form.resumo.trim() || !form.resultado.trim()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="registro-data">Data e hora</Label>
          <Input
            id="registro-data"
            type="datetime-local"
            required
            value={form.data}
            onChange={(e) => alterar("data", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="registro-local">{tipo === "visita" ? "Local ou loja" : "Canal"}</Label>
          <Input
            id="registro-local"
            maxLength={250}
            value={form.local}
            onChange={(e) => alterar("local", e.target.value)}
          />
        </div>
        <SelectAtividade
          label="Responsável"
          id="registro-responsavel"
          opcoes={pessoas}
          value={form.responsavel}
          onChange={(v) => alterar("responsavel", v)}
        />
        <SelectAtividade
          label="Disciplina"
          id="registro-disciplina"
          opcoes={disciplinas}
          value={form.disciplina}
          onChange={(v) => alterar("disciplina", v)}
        />
        <SelectAtividade
          label="Fornecedor"
          id="registro-fornecedor"
          opcoes={fornecedores}
          value={form.fornecedor}
          onChange={(v) => alterar("fornecedor", v)}
        />
        <div className="space-y-1">
          <Label htmlFor="registro-duracao">Duração em minutos</Label>
          <Input
            id="registro-duracao"
            type="number"
            min={1}
            max={1440}
            value={form.duracao}
            onChange={(e) => alterar("duracao", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="registro-resumo">Resumo</Label>
        <Input
          id="registro-resumo"
          maxLength={250}
          required
          value={form.resumo}
          onChange={(e) => alterar("resumo", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="registro-resultado">Resultado</Label>
        <Textarea
          id="registro-resultado"
          required
          maxLength={4000}
          value={form.resultado}
          onChange={(e) => alterar("resultado", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="registro-proximo">Próximo passo</Label>
        <Input
          id="registro-proximo"
          maxLength={4000}
          value={form.proximo}
          onChange={(e) => alterar("proximo", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="registro-anexo">Link do anexo</Label>
        <Input
          id="registro-anexo"
          type="url"
          maxLength={2000}
          value={form.anexo}
          onChange={(e) => alterar("anexo", e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.avaliar} onChange={(e) => alterar("avaliar", e.target.checked)} /> Avaliar
        cobrança
      </label>
    </FormDialog>
  );
}

function SelectAtividade({
  label,
  id,
  opcoes,
  value,
  onChange,
}: {
  label: string;
  id: string;
  opcoes: Opcao[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={CAMPOS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem vínculo</option>
        {opcoes.map((opcao) => (
          <option key={opcao.id} value={opcao.id}>
            {opcao.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
