import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CompanyData } from "../types";
import { getStatusBadge } from "../types";
import { useObjectUrl } from "@/pages/company/hooks/useObjectUrl";

interface CompanySummaryCardProps {
  companyData: CompanyData;
  usersCount: number;
  editingCompany: boolean;
  pendingLogoFile: File | null;
  onLogoPreview: () => void;
}

export function CompanySummaryCard({
  companyData,
  usersCount,
  editingCompany,
  pendingLogoFile,
  onLogoPreview,
}: CompanySummaryCardProps) {
  const previaLogo = useObjectUrl(pendingLogoFile);
  const openPreview = () => {
    if (pendingLogoFile || companyData.logoUrl) onLogoPreview();
  };

  return (
    <Card className={"overflow-hidden border border-border " + (editingCompany ? "ring-1 ring-brand/25" : "")}>
      <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div
            role="button"
            tabIndex={0}
            className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-muted"
            onClick={openPreview}
            onKeyDown={(e) => {
              if (e.key === "Enter") openPreview();
            }}
          >
            {pendingLogoFile ? (
              <img src={previaLogo ?? undefined} alt="Logo (prévia)" className="h-full w-full object-contain p-2" />
            ) : companyData.logoUrl ? (
              <img src={companyData.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-2xs text-muted-foreground">Sem logo</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{companyData.nomeEmpresa || "Empresa"}</p>
            <Badge className={"mt-1 rounded-full " + getStatusBadge(companyData.status).className}>
              {getStatusBadge(companyData.status).label}
            </Badge>
          </div>
          <Link
            to="/gestao/equipe"
            className="inline-flex shrink-0 items-center gap-1 text-sm text-ink hover:underline"
          >
            <span className="tabular-nums">{usersCount}</span> · Ver equipe
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <InfoField label="Email" value={companyData.email} />
          <InfoField label="Contato" value={companyData.contato} />
          <InfoField label="CNPJ" value={companyData.cnpj} />
          <InfoField
            label="Endereço"
            value={[companyData.endereco, companyData.cidade, companyData.estado, companyData.cep]
              .filter(Boolean)
              .join(", ")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-ink break-words">{value || "-"}</p>
    </div>
  );
}
