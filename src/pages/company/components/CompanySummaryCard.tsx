import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CompanyData } from "../types";
import { getStatusBadge } from "../types";

interface CompanySummaryCardProps {
  companyData: CompanyData;
  usersCount: number;
  editingCompany: boolean;
  pendingLogoFile: File | null;
  onLogoPreview: () => void;
}

export function CompanySummaryCard({ companyData, usersCount, editingCompany, pendingLogoFile, onLogoPreview }: CompanySummaryCardProps) {
  const openPreview = () => {
    if (pendingLogoFile || companyData.logoUrl) onLogoPreview();
  };

  return (
    <Card className={"border border-black/5 lg:col-span-1 overflow-hidden " + (editingCompany ? "ring-1 ring-accent-orange/25" : "")}>
      <CardHeader className={editingCompany ? "bg-accent-orange/5" : ""}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div
            role="button"
            tabIndex={0}
            className="h-28 w-28 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={openPreview}
            onKeyDown={(e) => { if (e.key === "Enter") openPreview(); }}
          >
            {pendingLogoFile ? (
              <img src={URL.createObjectURL(pendingLogoFile)} alt="Logo (prévia)" className="w-full h-full object-contain p-4" />
            ) : companyData.logoUrl ? (
              <img src={companyData.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
            ) : (
              <span className="text-xs text-black/50">Sem logo</span>
            )}
          </div>

          <div className="min-w-0">
            <CardTitle className="text-xl truncate">{companyData.nomeEmpresa || "Empresa"}</CardTitle>
            <div className="mt-2 flex justify-center">
              <Badge className={"rounded-full " + getStatusBadge(companyData.status).className}>
                {getStatusBadge(companyData.status).label}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <InfoField label="Email" value={companyData.email} />
            <InfoField label="Contato" value={companyData.contato} />
            <InfoField label="CNPJ" value={companyData.cnpj} />
            <InfoField label="Endereço" value={companyData.endereco} />
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Cidade" value={companyData.cidade} />
              <InfoField label="Estado" value={companyData.estado} />
            </div>
            <InfoField label="CEP" value={companyData.cep} />
          </div>

          <div className="rounded-xl border border-black/5 bg-white p-4">
            <p className="text-xs text-black/50">Pessoas vinculadas</p>
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-sm font-medium">{usersCount}</p>
              <Link to="/pessoas" className="text-sm text-accent-orange hover:underline inline-flex items-center gap-1">
                Ver pessoas
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-black/50">{label}</p>
      <p className="text-sm text-black/80 break-all">{value || "-"}</p>
    </div>
  );
}
