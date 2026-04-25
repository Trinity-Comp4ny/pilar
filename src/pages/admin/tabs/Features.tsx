import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CompanyFeatureToggles } from "@/components/admin/CompanyFeatureToggles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { parseUserFeatures, type CompanyFeatures, type FeatureKey, type SubscriptionPlanSlug } from "@/lib/features";

type RawUser = {
  id: string;
  role: string | null;
  features?: unknown;
};

type Props = {
  companyFeatures: CompanyFeatures;
  setCompanyFeatures: (next: CompanyFeatures) => void;
  currentPlan: SubscriptionPlanSlug;
  users: RawUser[];
};

export function FeaturesEmpresaTab({ companyFeatures, setCompanyFeatures, currentPlan, users }: Props) {
  const navigate = useNavigate();
  const requireAal2 = useRequireAal2();
  const [draft, setDraft] = useState<CompanyFeatures>(companyFeatures);
  const [isSaving, setIsSaving] = useState(false);

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
      // RPC entra nos types após gen:types pós-migration
      const { error } = await (
        supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }>
      )("update_company_features", { p_features: draft });
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
    <Card className="border border-black/5">
      <CardHeader>
        <CardTitle className="text-base">Features da Empresa</CardTitle>
        <CardDescription>
          Ative ou desative módulos. O plano sugere o conjunto incluso; add-ons são cobrados à parte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <CompanyFeatureToggles
          value={draft}
          onChange={setDraft}
          currentPlan={currentPlan}
          usersByFeature={usersByFeature}
          onChangePlan={() => navigate("/billing")}
        />

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(companyFeatures)} disabled={!dirty || isSaving}>
            Reverter
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || isSaving}
            className="bg-accent-orange text-ink hover:bg-accent-orange/90"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
