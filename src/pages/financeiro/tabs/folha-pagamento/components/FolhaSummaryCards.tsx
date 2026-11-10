import { KPICard } from "@/components/KPICard";

interface FolhaSummaryCardsProps {
  totalFolha: number;
  peopleCount: number;
  totalUniqueArea: number;
}

export function FolhaSummaryCards({ totalFolha, peopleCount, totalUniqueArea }: FolhaSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KPICard label="Total da Folha" value={totalFolha} subtitle="Fixo + bônus do que foi concluído no mês" />
      <KPICard label="Equipe" value={String(peopleCount)} subtitle="Colaboradores listados" />
      <KPICard
        label="Total Área Projetada"
        value={`${totalUniqueArea.toLocaleString("pt-BR")} m²`}
        subtitle="Projetos com a parte da equipe concluída no mês"
      />
    </div>
  );
}
