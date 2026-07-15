import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, QrCode } from "lucide-react";
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
  companyData,
  editing,
  isAdmin,
  isLoading,
  onEdit,
  onCancel,
  onSave,
  onChange,
  onStatusChange,
}: CompanyDataTabProps) {
  const inputClass = !editing
    ? "bg-black/5 border-black/10 text-black/80"
    : "border-brand/20 focus-visible:ring-brand/20";
  const readonlyClass = "bg-black/5 border-black/10 text-black/80";

  return (
    <Card className={"border border-black/5 " + (editing ? "ring-1 ring-brand/25" : "")}>
      <CardHeader className={"flex flex-row items-center justify-between " + (editing ? "bg-brand/5" : "")}>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 size={20} />
            Dados da Empresa
          </CardTitle>
          <CardDescription className="mt-1">Informações gerais sobre a empresa</CardDescription>
        </div>
        {!editing ? (
          <Button
            onClick={onEdit}
            className="rounded-full bg-brand hover:bg-brand/90 text-ink"
            disabled={!isAdmin || isLoading}
          >
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="rounded-full">
              Cancelar
            </Button>
            <Button onClick={onSave} className="rounded-full bg-brand hover:bg-brand/90 text-ink">
              Salvar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-nome">Nome da Empresa</Label>
                <Input
                  id="company-nome"
                  value={companyData.nomeEmpresa}
                  onChange={(e) => onChange("nomeEmpresa", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-cnpj">CNPJ</Label>
                <Input
                  id="company-cnpj"
                  value={companyData.cnpj}
                  onChange={(e) => onChange("cnpj", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={companyData.email}
                  onChange={(e) => onChange("email", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-contato">Contato</Label>
                <Input
                  id="company-contato"
                  value={companyData.contato}
                  onChange={(e) => onChange("contato", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="company-status">Status</Label>
                {editing ? (
                  <Select value={companyData.status} onValueChange={onStatusChange}>
                    <SelectTrigger id="company-status" className={inputClass}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
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
                <Label htmlFor="company-endereco">Endereço</Label>
                <Input
                  id="company-endereco"
                  value={companyData.endereco}
                  onChange={(e) => onChange("endereco", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-cidade">Cidade</Label>
                <Input
                  id="company-cidade"
                  value={companyData.cidade}
                  onChange={(e) => onChange("cidade", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-estado">Estado</Label>
                <Input
                  id="company-estado"
                  value={companyData.estado}
                  onChange={(e) => onChange("estado", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-cep">CEP</Label>
                <Input
                  id="company-cep"
                  value={companyData.cep}
                  onChange={(e) => onChange("cep", e.target.value)}
                  readOnly={!editing}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-3">
                <QrCode size={16} className="text-brand" />
                <span className="text-sm font-semibold">Cobrança direta (sem Asaas)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Dados enviados nos emails de cobrança manual. Mantém seu 100% — zero taxa de gateway.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-pix-chave">Chave Pix</Label>
                  <Input
                    id="company-pix-chave"
                    value={companyData.pixChave || ""}
                    onChange={(e) => onChange("pixChave", e.target.value)}
                    readOnly={!editing}
                    className={inputClass}
                    placeholder="CPF, CNPJ, email, telefone ou aleatória"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-pix-instrucoes">Instruções (opcional)</Label>
                  <Textarea
                    id="company-pix-instrucoes"
                    value={companyData.pixInstrucoes || ""}
                    onChange={(e) => onChange("pixInstrucoes", e.target.value)}
                    readOnly={!editing}
                    className={inputClass}
                    placeholder="Ex: Titular João Silva, Itaú"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
