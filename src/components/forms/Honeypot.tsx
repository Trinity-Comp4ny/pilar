interface HoneypotProps {
  value: string;
  onChange: (value: string) => void;
  /** Nome do campo-armadilha. Padrão: "website". */
  name?: string;
}

/**
 * Armadilha anti-spam. Fica escondida de usuários reais, mas bots preenchem.
 * Se vier com valor no submit, descarte o envio silenciosamente.
 */
export function Honeypot({ value, onChange, name = "website" }: HoneypotProps) {
  const id = `hp-${name}`;
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden opacity-0">
      <label htmlFor={id}>Não preencha este campo</label>
      <input
        id={id}
        name={name}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
