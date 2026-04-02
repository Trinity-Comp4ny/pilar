import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import type { CompanyData } from "../types";
import { STATUS_OPTIONS, getStatusBadge } from "../types";

interface CompanyDataTabProps {
  companyData: CompanyData;
  editing: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (field: keyof CompanyData, value: string) => void;
  onStatusChange: (value: string) => void;
}

export function CompanyDataTab({
  companyData, editing, isAdmin, isLoading,
  onEdit, onCancel, onSave, onChange, onStatusChange,
}: CompanyDataTabProps) {
  const inputClass = !editing
    ? "bg-black/5 border-black/10 text-black/80"
    : "border-accent-orange/20 focus-visible:ring-accent-orange/20";
  const readonlyClass = "bg-black/5 border-black/10 text-black/80";

  return (
    <Card className={"border border-black/5 " + (editing ? "ring-1 ring-accent-orange/25" : "")}>
      <CardHeader className={"flex flex-row items-center justify-between " + (editing ? "bg-accent-orange/5" : "")}>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 size={20} />
            Dados da Empresa
          </CardTitle>
          <CardDescription className="mt-1">Informações gerais sobre a empresa</CardDescription>
        </div>
        {!editing ? (
          <Button onClick={onEdit} className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white" disabled={!isAdmin || isLoading}>
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="rounded-full">Cancelar</Button>
            <Button onClick={onSave} className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white">Salvar</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input value={companyData.nomeEmpresa} onChange={(e) => onChange("nomeEmpresa", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={companyData.cnpj} onChange={(e) => onChange("cnpj", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={companyData.email} onChange={(e) => onChange("email", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label>Contato</Label>
            <Input value={companyData.contato} onChange={(e) => onChange("contato", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Status</Label>
            {editing ? (
              <Select value={companyData.status} onValueChange={onStatusChange}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className={"h-10 rounded-md px-3 flex items-center " + readonlyClass}>
                <Badge className={"rounded-full " + getStatusBadge(companyData.status).className}>
                  {getStatusBadge(companyData.status).label}
                </Badge>
              </div>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Endereço</Label>
            <Input value={companyData.endereco} onChange={(e) => onChange("endereco", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={companyData.cidade} onChange={(e) => onChange("cidade", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={companyData.estado} onChange={(e) => onChange("estado", e.target.value)} readOnly={!editing} className={inputClass} maxLength={2} />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={companyData.cep} onChange={(e) => onChange("cep", e.target.value)} readOnly={!editing} className={inputClass} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
