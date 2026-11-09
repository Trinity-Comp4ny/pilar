import { useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Input } from "@/components/ui/input";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import type { Adicional } from "@/schemas/estimativaObra";
import { Campo } from "./componentes";
import { lerNumero } from "./lib";
import {
  camposDoItem,
  erroDoAjuste,
  montarAjuste,
  valorDaEmpresa,
  valorDaReferencia,
  unidadeDoPreco,
  type Ajuste,
  type CampoDePreco,
} from "./ajustesDaEmpresa";

interface Props {
  /** Item aberto; `null` fecha. */
  item: { rotulo: string; adicional: Adicional } | null;
  /** Ajuste que a empresa já tem para o item. */
  atual?: Ajuste;
  salvando?: boolean;
  onFechar: () => void;
  onSalvar: (ajuste: Ajuste) => void;
  /** Quem está salvando e quando, para o registro. */
  registro: () => { atualizadoEm: string; atualizadoPor: string };
}

const textoInicial = (campo: CampoDePreco, atual: Ajuste | undefined): string => {
  const v = valorDaEmpresa(atual, campo);
  if (v === undefined) return "";
  return campo.tipo === "reais" ? formatValorToInput(v) : String(v).replace(".", ",");
};

const referenciaEmTexto = (campo: CampoDePreco, a: Adicional): string | null => {
  const v = valorDaReferencia(a, campo);
  if (v === undefined) return null;
  return campo.tipo === "reais" ? formatValorToInput(v) : `${String(v).replace(".", ",")}%`;
};

/** Valor da empresa para um item: um campo por valor que o item aceita. Campo em branco usa a referência. */
export function EditarPrecoDialog(props: Props) {
  return <Formulario key={props.item?.adicional.rotulo ?? "fechado"} {...props} />;
}

function Formulario({ item, atual, salvando, onFechar, onSalvar, registro }: Props) {
  const campos = item ? camposDoItem(item.adicional) : [];
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.caminho, textoInicial(c, atual)]))
  );
  const [observacao, setObservacao] = useState(typeof atual?.observacao === "string" ? atual.observacao : "");
  const [erro, setErro] = useState<string | null>(null);

  const enviar = () => {
    if (!item) return;
    const valores: Record<string, number> = {};
    for (const c of campos) {
      const texto = (textos[c.caminho] ?? "").trim();
      if (!texto) continue;
      const n = c.tipo === "reais" ? parseCurrencyString(texto) : lerNumero(texto);
      if (!Number.isFinite(n)) {
        setErro(`Confira "${c.rotulo}": informe um número`);
        return;
      }
      valores[c.caminho] = n;
    }
    const ajuste = montarAjuste(item.adicional, valores, { ...registro(), observacao: observacao.trim() || undefined });
    const problema = erroDoAjuste(item.adicional, ajuste);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    onSalvar(ajuste);
  };

  return (
    <FormDialog
      open={item !== null}
      onOpenChange={(aberto) => !aberto && onFechar()}
      title={item ? `Valor da sua empresa: ${item.rotulo}` : "Valor da sua empresa"}
      description="Este valor vale antes do SINAPI e da referência do Pilar em toda estimativa da empresa. Versões já salvas guardam o valor da época."
      submitLabel="Salvar valor"
      isPending={salvando}
      onSubmit={enviar}
    >
      {item && (
        <div className="space-y-4">
          {campos.map((c) => {
            const id = `preco-${c.caminho.replace(".", "-")}`;
            const referencia = referenciaEmTexto(c, item.adicional);
            return (
              <Campo
                key={c.caminho}
                id={id}
                rotulo={c.rotulo}
                dica={
                  referencia
                    ? `Referência do Pilar: ${referencia}. Em branco, vale a referência.`
                    : `Por ${unidadeDoPreco(item.adicional)}.`
                }
              >
                {c.tipo === "reais" ? (
                  <MoneyInput
                    id={id}
                    value={textos[c.caminho] ?? ""}
                    onChange={(v) => setTextos((t) => ({ ...t, [c.caminho]: v }))}
                  />
                ) : (
                  <div className="relative">
                    <Input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      className="pr-10 tabular-nums"
                      value={textos[c.caminho] ?? ""}
                      onChange={(e) => setTextos((t) => ({ ...t, [c.caminho]: e.target.value }))}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-soft">
                      %
                    </span>
                  </div>
                )}
              </Campo>
            );
          })}
          <Campo id="preco-observacao" rotulo="Observação (opcional)">
            <Input
              id="preco-observacao"
              value={observacao}
              maxLength={200}
              placeholder="Ex.: tabela do fornecedor, out/2026"
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Campo>
          {erro && (
            <p role="alert" className="text-xs text-danger-mid">
              {erro}
            </p>
          )}
        </div>
      )}
    </FormDialog>
  );
}
