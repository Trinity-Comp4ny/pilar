import { useState } from "react";
import { PilarPage } from "@/components/PilarPage";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { usePageTitle } from "@/hooks/usePageTitle";
import { CubImportacao } from "./components/CubImportacao";
import { ParametrosEstimativa } from "./components/ParametrosEstimativa";

type Aba = "cub" | "parametros";

const ABAS: ViewOption<Aba>[] = [
  { value: "cub", label: "CUB" },
  { value: "parametros", label: "Parâmetros" },
];

/**
 * Estimativa de obra no portal ultra admin (SPEC 136): o CUB que o ultra admin importa todo mês e os
 * parâmetros do motor, com o gate de validação. Valem para todas as empresas.
 */
export default function Estimativa() {
  usePageTitle("Estimativa de obra · Ultra admin");
  const [aba, setAba] = useState<Aba>("cub");

  return (
    <PilarPage title="Estimativa de obra">
      <p className="-mt-2 text-sm text-ink-soft">
        Preço de referência e parâmetros de cálculo. Só o ultra admin escreve; toda empresa lê.
      </p>
      <ViewSwitcher options={ABAS} value={aba} onChange={setAba} ariaLabel="Seção da estimativa" />
      {aba === "cub" ? <CubImportacao /> : <ParametrosEstimativa />}
    </PilarPage>
  );
}
