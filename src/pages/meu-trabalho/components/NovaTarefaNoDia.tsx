import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PessoaOpcao } from "../hooks";

const SEM = "__none__";

export type NovaTarefaNoDiaDados = {
  titulo: string;
  responsavelId: string | null;
  projetoId: string | null;
};

type Props = {
  /** Dia escolhido na Agenda, já formatado para leitura ("18 de outubro"). */
  rotuloDia: string;
  /** Prazo da tarefa, também para leitura ("18 out 2026"). */
  rotuloPrazo: string;
  pessoas: PessoaOpcao[];
  projetos: PessoaOpcao[];
  minhaPessoaId: string | null;
  /** Só admin escolhe o responsável; os demais criam já atribuído a si. */
  podeEscolherResponsavel: boolean;
  /** Devolve true quando gravou (o quadro fecha); false mantém o que foi digitado. */
  onCriar: (dados: NovaTarefaNoDiaDados) => Promise<boolean>;
  /** Abre o formulário completo com o nome digitado e o prazo do dia. */
  onMaisCampos: (titulo: string) => void;
  onFechar: () => void;
};

/**
 * Quadro curto da Agenda (SPEC 140): nome, responsável e projeto. O prazo é o dia onde se clicou.
 * Qualquer outro campo fica no formulário completo ("Mais campos").
 */
export function NovaTarefaNoDia({
  rotuloDia,
  rotuloPrazo,
  pessoas,
  projetos,
  minhaPessoaId,
  podeEscolherResponsavel,
  onCriar,
  onMaisCampos,
  onFechar,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [responsavelId, setResponsavelId] = useState<string | null>(minhaPessoaId);
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const erroNome = tentou && titulo.trim().length === 0;

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (titulo.trim().length === 0) {
      setTentou(true);
      return;
    }
    setSalvando(true);
    const gravou = await onCriar({ titulo: titulo.trim(), responsavelId, projetoId });
    setSalvando(false);
    if (gravou) onFechar();
  };

  return (
    <form onSubmit={criar} className="space-y-3">
      <h4 className="text-sm font-medium">Nova tarefa em {rotuloDia}</h4>

      <div className="space-y-1">
        <Label htmlFor="nova-tarefa-nome" className="text-xs text-muted-foreground">
          Nome
        </Label>
        <Input
          id="nova-tarefa-nome"
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="O que precisa ser feito"
          aria-invalid={erroNome}
          aria-describedby={erroNome ? "nova-tarefa-nome-erro" : undefined}
          className={erroNome ? "border-destructive" : undefined}
        />
        {erroNome && (
          <p id="nova-tarefa-nome-erro" role="alert" className="text-xs text-destructive">
            Dê um nome à tarefa para criar.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Responsável</Label>
        <Select
          value={responsavelId ?? SEM}
          onValueChange={(v) => setResponsavelId(v === SEM ? null : v)}
          disabled={!podeEscolherResponsavel}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sem responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM}>Sem responsável</SelectItem>
            {pessoas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Projeto (opcional)</Label>
        <Select value={projetoId ?? SEM} onValueChange={(v) => setProjetoId(v === SEM ? null : v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sem projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM}>Sem projeto</SelectItem>
            {projetos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="brand" size="sm" loading={salvando}>
          Criar tarefa
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onMaisCampos(titulo.trim())}>
          Mais campos
        </Button>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Prazo: {rotuloPrazo}</p>
    </form>
  );
}
