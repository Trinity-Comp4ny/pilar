import { useState } from "react";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ComentariosLista } from "@/components/atividades/ComentariosLista";
import { AtividadeComposer } from "@/components/atividades/AtividadeComposer";
import { useLeadAtividades } from "../hooks/useLeadAtividades";
import { useAuth } from "@/contexts/AuthContext";
import { BusyMark } from "@/components/motion/BusyMark";

export function LeadAtividadesPanel({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const { profile } = useAuth();
  const { data = [], isLoading, isError, refetch, adicionar, excluir } = useLeadAtividades(leadId);
  const [dia, setDia] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState(format(new Date(), "HH:mm"));
  const [erroData, setErroData] = useState("");
  const autorNome = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const comentarios = data.map((a) => ({
    id: a.id,
    texto: a.texto,
    autor: a.autor_nome,
    autorId: a.autor_id,
    data: a.ocorrido_em,
  }));

  return (
    <section aria-label="Atividades do lead" className="flex h-full min-h-0 flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">Atividades</h3>
      <p className="text-xs text-muted-foreground">
        Registre reuniões, contatos e o que ficou combinado. As notas do cadastro continuam no resumo.
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" aria-live="polite">
        {isLoading ? (
          <BusyMark />
        ) : isError ? (
          <div role="alert" className="text-sm">
            Não foi possível carregar as atividades.
            <Button variant="ghost" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <ComentariosLista
            comentarios={comentarios}
            pessoas={[]}
            autorNome={autorNome}
            vazio="Nenhuma atividade registrada"
            onExcluir={canEdit ? (id) => excluir.mutateAsync(id) : undefined}
          />
        )}
      </div>
      {canEdit && (
        <div className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="atividade-dia">Data da atividade</Label>
              <DatePicker id="atividade-dia" value={dia} onChange={setDia} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="atividade-hora">Horário</Label>
              <Input id="atividade-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          {erroData && (
            <p role="alert" className="text-xs text-danger-strong">
              {erroData}
            </p>
          )}
          <AtividadeComposer
            pessoas={[]}
            habilitarMencoes={false}
            placeholder="O que aconteceu com este lead?"
            onSubmit={async (texto) => {
              const ocorrido = new Date(`${dia}T${hora}:00`);
              if (!dia || !hora || !Number.isFinite(ocorrido.getTime())) {
                setErroData("Informe data e horário válidos.");
                throw new Error("Data inválida");
              }
              setErroData("");
              await adicionar.mutateAsync({ texto, ocorridoEm: ocorrido.toISOString() });
            }}
          />
        </div>
      )}
    </section>
  );
}
