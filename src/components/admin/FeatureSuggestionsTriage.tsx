import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";

export type FeatureSuggestionStatus = "novo" | "em_analise" | "planejado" | "descartado";

export type ManagedFeatureSuggestion = {
  id: string;
  titulo: string;
  descricao: string;
  createdAt: string;
  authorEmail: string | null;
  statusInterno: FeatureSuggestionStatus;
};

const STATUS_OPTIONS: { value: FeatureSuggestionStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "planejado", label: "Planejado" },
  { value: "descartado", label: "Descartado" },
];

export type FeatureSuggestionsTriageProps = {
  suggestions: ManagedFeatureSuggestion[];
  onChangeStatus: (id: string, status: FeatureSuggestionStatus) => void;
};

export function FeatureSuggestionsTriage({ suggestions, onChangeStatus }: FeatureSuggestionsTriageProps) {
  return (
    <Card className="border border-black/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb size={20} strokeWidth={1.5} />
          Feedback dos usuários
        </CardTitle>
        <CardDescription>
          Sugestões enviadas pelo modal de feedback do app. Triagem interna, sem visibilidade pro usuário.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="w-48">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-black/50">
                  Nenhuma sugestão enviada ainda.
                </TableCell>
              </TableRow>
            ) : (
              suggestions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-sm font-medium">
                    <p className="line-clamp-1">{s.titulo}</p>
                    <p className="line-clamp-2 text-xs font-normal text-black/50">{s.descricao}</p>
                  </TableCell>
                  <TableCell className="text-black/70">{s.authorEmail ?? "-"}</TableCell>
                  <TableCell className="text-black/70">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell>
                    <Select
                      value={s.statusInterno}
                      onValueChange={(value) => onChangeStatus(s.id, value as FeatureSuggestionStatus)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
