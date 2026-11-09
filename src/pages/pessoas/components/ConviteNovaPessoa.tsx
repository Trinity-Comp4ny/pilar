import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Caixa "Dar acesso ao Pilar" do cadastro de pessoa nova. */
export function CampoDarAcesso({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="enviar_convite"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="enviar_convite" className="text-sm font-medium">
            Dar acesso ao Pilar
          </Label>
          <p className="text-xs text-muted-foreground">
            Envia o convite para o e-mail acima. Com acesso, a pessoa aparece no @ das atividades e recebe os avisos.
          </p>
        </div>
      </div>
    </div>
  );
}
