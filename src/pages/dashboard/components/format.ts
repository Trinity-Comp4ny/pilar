/**
 * @deprecated Delegates para "@/lib/format" (ADR 0008). Mantidos pela API
 * `.format()` que os widgets do Dashboard consomem; migrar os widgets para
 * formatCurrency direto e remover este módulo.
 */
import { formatCurrency } from "@/lib/format";

export const fmt = { format: (v: number) => formatCurrency(v) };

export const fmtCompact = { format: (v: number) => formatCurrency(v, { compact: true }) };
