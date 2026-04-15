import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette, Upload, Maximize2 } from "lucide-react";
import type { CompanyData } from "../types";

interface CompanyVisualTabProps {
  companyData: CompanyData;
  editing: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  pendingLogoFile: File | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onLogoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoPreview: () => void;
}

export function CompanyVisualTab({
  companyData,
  editing,
  isAdmin,
  isLoading,
  pendingLogoFile,
  onEdit,
  onCancel,
  onSave,
  onLogoFileChange,
  onLogoPreview,
}: CompanyVisualTabProps) {
  const openPreview = () => {
    if (pendingLogoFile || companyData.logoUrl) onLogoPreview();
  };

  return (
    <Card className={"border border-black/5 " + (editing ? "ring-1 ring-accent-orange/25" : "")}>
      <CardHeader className={"flex flex-row items-center justify-between " + (editing ? "bg-accent-orange/5" : "")}>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Palette size={20} />
            Personalização Visual
          </CardTitle>
          <CardDescription className="mt-1">Envie a logo da sua empresa</CardDescription>
        </div>
        {!editing ? (
          <Button
            onClick={onEdit}
            className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
            disabled={!isAdmin || isLoading}
          >
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="rounded-full">
              Cancelar
            </Button>
            <Button onClick={onSave} className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white">
              Salvar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Upload size={14} />
              Logo da Empresa
            </Label>
            <Input type="file" accept="image/*" onChange={onLogoFileChange} disabled={!editing} />
            <p className="text-xs text-black/50">Recomendado: PNG/SVG com fundo transparente.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Pré-visualização</Label>
              {(pendingLogoFile || companyData.logoUrl) && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onLogoPreview}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div
              role="button"
              tabIndex={0}
              className="p-4 bg-black/5 rounded-xl min-h-[180px] border border-black/10 flex items-center justify-center cursor-pointer"
              onClick={openPreview}
              onKeyDown={(e) => {
                if (e.key === "Enter") openPreview();
              }}
            >
              {pendingLogoFile ? (
                <img
                  src={URL.createObjectURL(pendingLogoFile)}
                  alt="Logo (prévia)"
                  className="max-h-[240px] w-full object-contain"
                />
              ) : companyData.logoUrl ? (
                <img src={companyData.logoUrl} alt="Logo" className="max-h-[240px] w-full object-contain" />
              ) : (
                <span className="text-sm text-black/50">Nenhuma logo enviada</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
