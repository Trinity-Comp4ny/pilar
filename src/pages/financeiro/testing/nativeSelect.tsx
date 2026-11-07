/**
 * Substituto de teste para `@/components/ui/select` (Radix). O jsdom não
 * implementa pointer capture nem layout, então o Select do Radix não abre em
 * teste. Aqui ele vira um `<select>` nativo com as mesmas opções, e o teste
 * escolhe valor com `fireEvent.change`. Uso:
 *
 *   vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
 *
 * O nome acessível do `<select>` vem do `aria-label` do `SelectTrigger`; sem ele,
 * o teste localiza o campo pelo rótulo vizinho (`campoSelect`).
 */
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

type ItemProps = { value: string; disabled?: boolean; children?: ReactNode };

function textoDe(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  if (isValidElement(node)) return textoDe((node.props as { children?: ReactNode }).children);
  return "";
}

function coletar(children: ReactNode, itens: ItemProps[], gatilho: { ariaLabel?: string }) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<Record<string, unknown>>;
    if (el.type === SelectItem) {
      itens.push(el.props as unknown as ItemProps);
      return;
    }
    if (el.type === SelectTrigger) {
      gatilho.ariaLabel = el.props["aria-label"] as string | undefined;
      return;
    }
    coletar(el.props.children as ReactNode, itens, gatilho);
  });
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const itens: ItemProps[] = [];
  const gatilho: { ariaLabel?: string } = {};
  coletar(children, itens, gatilho);
  return (
    <select
      aria-label={gatilho.ariaLabel}
      data-native-select=""
      value={value ?? defaultValue ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="">(vazio)</option>
      {itens.map((i) => (
        <option key={i.value} value={i.value} disabled={i.disabled}>
          {textoDe(i.children)}
        </option>
      ))}
    </select>
  );
}

export function SelectTrigger(_: { children?: ReactNode; className?: string; "aria-label"?: string }) {
  return null;
}
export function SelectItem(_: ItemProps & { className?: string }) {
  return null;
}
export function SelectValue(_: { placeholder?: string }) {
  return null;
}
export function SelectContent({ children }: { children?: ReactNode; className?: string }) {
  return <>{children}</>;
}
export function SelectGroup({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export function SelectLabel(_: { children?: ReactNode }) {
  return null;
}
export function SelectSeparator() {
  return null;
}
export function SelectScrollUpButton() {
  return null;
}
export function SelectScrollDownButton() {
  return null;
}
