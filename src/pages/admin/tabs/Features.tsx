import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { parseUserFeatures, type CompanyFeatures, type FeatureKey } from "@/lib/features";

type RawUser = {
  id: string;
  role: string | null;
  features?: unknown;
};

type Props = {
  companyFeatures: CompanyFeatures;
  setCompanyFeatures: (next: CompanyFeatures) => void;
  users: RawUser[];
};

export function FeaturesEmpresaTab({ companyFeatures, setCompanyFeatures, users }: Props) {
  const requireAal2 = useRequireAal2();
  const [draft, setDraft] = useState<CompanyFeatures>(companyFeatures);
  const [isSaving, setIsSaving] = useState(false);

  // Sincroniza draft quando companyFeatures carrega do banco (prop chega vazia inicialmente)
  useEffect(() => {
    setDraft(companyFeatures);
  }, [companyFeatures]);

  const usersByFeature = useMemo(() => {
    const counts: Partial<Record<FeatureKey, number>> = {};
    for (const u of users) {
      if (u.role !== "user") continue;
      const features = parseUserFeatures(u.features);
      for (const key of Object.keys(features) as FeatureKey[]) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [users]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(companyFeatures);

  const handleSave = async () => {
    if (!(await requireAal2())) return;
    setIsSaving(true);
    try {
      // gen:types ainda não inclui update_company_features
      const { error } = await callUntypedRpc("update_company_features", { p_features: draft });
      if (error) throw error;
      setCompanyFeatures(draft);
      toast.success("Features atualizadas");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error("Erro ao salvar", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border border-black/5 bg-white">
      <CardHeader>
        <CardTitle className="text-lg font-medium tracking-tight">Acesso antecipado</CardTitle>
        <CardDescription>
          Módulo maduro (Financeiro, Projetos, Obras...) já vem ligado pra sua empresa, sem precisar ativar aqui.
          Isto é só para dar acesso cedo a um módulo ainda não lançado pra todo mundo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <CompanyFeatureToggles value={draft} onChange={setDraft} usersByFeature={usersByFeature} />

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(companyFeatures)} disabled={!dirty || isSaving}>
            Reverter
          </Button>
          <Button onClick={handleSave} disabled={!dirty || isSaving} variant="brand">
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
