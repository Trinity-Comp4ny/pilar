import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Palette } from "lucide-react";
import { formatCNPJ, formatPhone, onlyDigits } from "@/lib/maskUtils";
import { CompanyDataTab } from "@/pages/company/components/CompanyDataTab";
import { CompanyVisualTab } from "@/pages/company/components/CompanyVisualTab";
import { CompanySummaryCard } from "@/pages/company/components/CompanySummaryCard";
import { LogoPreviewDialog } from "@/pages/company/components/CompanyDialogs";
import type { CompanyData } from "@/pages/company/types";

type Props = {
  companyId: string | null;
  companyData: CompanyData;
  setCompanyData: (updater: (prev: CompanyData) => CompanyData) => void;
  usersCount: number;
  isLoading: boolean;
};

export function EmpresaTab({ companyId, companyData, setCompanyData, usersCount, isLoading }: Props) {
  const [editingData, setEditingData] = useState(false);
  const [editingVisual, setEditingVisual] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [isLogoPreviewOpen, setIsLogoPreviewOpen] = useState(false);

  const formatCEP = (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    if (!digits) return "";
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleFieldChange = (field: keyof CompanyData, value: string) => {
    const formatters: Partial<Record<keyof CompanyData, (v: string) => string>> = {
      cnpj: formatCNPJ,
      contato: formatPhone,
      cep: formatCEP,
    };
    const formatted = formatters[field] ? formatters[field]!(value) : value;
    setCompanyData((prev) => ({ ...prev, [field]: formatted }));
  };

  const handleSaveData = async () => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from("empresas")
        .update({
          nome: companyData.nomeEmpresa,
          cnpj: companyData.cnpj,
          status: companyData.status as "active" | "suspended" | "cancelled",
          email: companyData.email,
          contato: companyData.contato,
          endereco: companyData.endereco,
          cidade: companyData.cidade,
          estado: companyData.estado,
          cep: companyData.cep,
        })
        .eq("id", companyId);
      if (error) throw error;

      setEditingData(false);
      toast.success("Dados salvos", { description: "Informações da empresa atualizadas com sucesso" });
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  const MAX_LOGO_SIZE = 2 * 1024 * 1024;

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato inválido", { description: "Use PNG, JPG, WebP ou SVG." });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Arquivo muito grande", { description: "O logo deve ter no máximo 2MB." });
      e.target.value = "";
      return;
    }
    setPendingLogoFile(file);
  };

  const handleSaveVisual = async () => {
    if (!pendingLogoFile || !companyId) {
      setEditingVisual(false);
      return;
    }
    try {
      const ext = pendingLogoFile.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${companyId}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, pendingLogoFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("company-logos").getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from("empresas")
        .update({ logo_url: data.publicUrl })
        .eq("id", companyId);
      if (updateError) throw updateError;

      setCompanyData((prev) => ({ ...prev, logoUrl: data.publicUrl }));
      setPendingLogoFile(null);
      setEditingVisual(false);
      toast.success("Configuração salva", { description: "Visual da empresa atualizado com sucesso" });
    } catch {
      toast.error("Erro ao salvar logo");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CompanySummaryCard
        companyData={companyData}
        usersCount={usersCount}
        editingCompany={editingData}
        pendingLogoFile={pendingLogoFile}
        onLogoPreview={() => setIsLogoPreviewOpen(true)}
      />

      <div className="lg:col-span-2">
        <Tabs defaultValue="dados" className="w-full">
          <TabsList>
            <TabsTrigger value="dados" className="gap-2">
              <Building2 size={16} /> Dados
            </TabsTrigger>
            <TabsTrigger value="visual" className="gap-2">
              <Palette size={16} /> Personalização
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-6">
            <CompanyDataTab
              companyData={companyData}
              editing={editingData}
              isAdmin={true}
              isLoading={isLoading}
              onEdit={() => setEditingData(true)}
              onCancel={() => setEditingData(false)}
              onSave={handleSaveData}
              onChange={handleFieldChange}
              onStatusChange={(v) => setCompanyData((prev) => ({ ...prev, status: v }))}
            />
          </TabsContent>

          <TabsContent value="visual" className="mt-6">
            <CompanyVisualTab
              companyData={companyData}
              editing={editingVisual}
              isAdmin={true}
              isLoading={isLoading}
              pendingLogoFile={pendingLogoFile}
              onEdit={() => setEditingVisual(true)}
              onCancel={() => {
                setEditingVisual(false);
                setPendingLogoFile(null);
              }}
              onSave={handleSaveVisual}
              onLogoFileChange={handleLogoFileChange}
              onLogoPreview={() => setIsLogoPreviewOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <LogoPreviewDialog
        open={isLogoPreviewOpen}
        onOpenChange={setIsLogoPreviewOpen}
        pendingLogoFile={pendingLogoFile}
        logoUrl={companyData.logoUrl}
      />
    </div>
  );
}
