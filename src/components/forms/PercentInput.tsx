import * as React from "react";

import { NumberInput, type NumberInputProps } from "./NumberInput";

export type PercentInputProps = Omit<NumberInputProps, "suffix" | "allowDecimal" | "min" | "max">;

/**
 * Campo de percentual: sufixo "%", decimal permitido e clamp 0–100.
 * Fino wrapper do NumberInput para não repetir esses ajustes em cada form.
 */
export const PercentInput = React.forwardRef<HTMLInputElement, PercentInputProps>((props, ref) => (
  <NumberInput ref={ref} allowDecimal suffix="%" min={0} max={100} placeholder="0" {...props} />
));
PercentInput.displayName = "PercentInput";
