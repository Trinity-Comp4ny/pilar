interface TooltipPayloadEntry {
  color: string;
  name: string;
  value: string | number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

export const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-black/10 rounded-lg shadow-lg">
        <p className="font-medium text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-ink-muted">{entry.name}:</span>
            <span className="font-medium">
              R$ {typeof entry.value === "number" ? entry.value.toLocaleString("pt-BR") : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};
