import { useEffect, useState, type ReactNode } from "react";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { SubscriptionPlanSlug } from "@/lib/features";
import { PLAN_LABEL, type EmpresaDetalhe } from "../api";

/**
 * Confirmação de ação sensível sobre a empresa: digita o nome pra liberar o
 * botão. O backend confere o nome de novo (confirm_name), isto é só a trava
 * de UI contra clique no lugar errado.
 */
function ConfirmarComNome({
  open,
  onOpenChange,
  title,
  description,
  empresaNome,
  submitLabel,
  destrutivo = false,
  isPending,
  extraValido = true,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  empresaNome: string;
  submitLabel: string;
  destrutivo?: boolean;
  isPending: boolean;
  extraValido?: boolean;
  onConfirm: (confirmName: string) => void;
  children?: ReactNode;
}) {
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (!open) setTexto("");
  }, [open]);
  const confere = texto.trim() === empresaNome.trim();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      submitLabel={submitLabel}
      submitVariant={destrutivo ? "destructive" : "brand"}
      isPending={isPending}
      submitDisabled={!confere || !extraValido}
      onSubmit={() => confere && extraValido && onConfirm(texto.trim())}
    >
      {children}
      <div className="space-y-1.5">
        <Label htmlFor="confirmar-nome-empresa">
          Digite <span className="font-semibold text-ink">{empresaNome}</span> para confirmar
        </Label>
        <Input
          id="confirmar-nome-empresa"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={empresaNome}
          autoComplete="off"
        />
      </div>
    </FormDialog>
  );
}

type DialogBase = { open: boolean; onOpenChange: (open: boolean) => void; isPending: boolean };

export function CriarEmpresaDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: DialogBase & { onConfirm: (input: { nome: string; ownerEmail: string }) => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (!open) {
      setNome("");
      setEmail("");
    }
  }, [open]);
  const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Criar empresa"
      description="Nasce convidada (usa sem pagar) e o dono recebe um convite de admin por e-mail."
      size="sm"
      submitLabel="Criar e convidar dono"
      isPending={isPending}
      submitDisabled={!nome.trim() || !emailValido}
      onSubmit={() => onConfirm({ nome: nome.trim(), ownerEmail: email.trim() })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="criar-empresa-nome">Nome da empresa</Label>
        <Input
          id="criar-empresa-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Alfa Engenharia"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="criar-empresa-email">E-mail do dono</Label>
        <Input
          id="criar-empresa-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="dono@empresa.com.br"
        />
      </div>
    </FormDialog>
  );
}

export type EdicaoEmpresa = {
  nome: string;
  cnpj: string | null;
  plano: SubscriptionPlanSlug;
  max_projetos_override: number | null;
  max_usuarios_override: number | null;
};

/** String do form pro override: vazia = sem override (null, usa o padrão do plano). */
function parseLimite(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isInteger(n) && n >= 0 ? n : null;
}

export function EditarEmpresaDialog({
  open,
  onOpenChange,
  isPending,
  empresa,
  onConfirm,
}: DialogBase & { empresa: EmpresaDetalhe; onConfirm: (patch: EdicaoEmpresa) => void }) {
  const [nome, setNome] = useState(empresa.nome);
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? "");
  const [plano, setPlano] = useState<SubscriptionPlanSlug>(empresa.plano);
  const [maxProjetos, setMaxProjetos] = useState("");
  const [maxUsuarios, setMaxUsuarios] = useState("");

  useEffect(() => {
    if (!open) return;
    setNome(empresa.nome);
    setCnpj(empresa.cnpj ?? "");
    setPlano(empresa.plano);
    setMaxProjetos(empresa.maxProjetosOverride === null ? "" : String(empresa.maxProjetosOverride));
    setMaxUsuarios(empresa.maxUsuariosOverride === null ? "" : String(empresa.maxUsuariosOverride));
  }, [open, empresa]);

  const temLimite = empresa.maxProjetosOverride !== null || empresa.maxUsuariosOverride !== null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar empresa"
      size="md"
      isPending={isPending}
      submitDisabled={!nome.trim()}
      onSubmit={() =>
        onConfirm({
          nome: nome.trim(),
          cnpj: cnpj.trim() || null,
          plano,
          max_projetos_override: parseLimite(maxProjetos),
          max_usuarios_override: parseLimite(maxUsuarios),
        })
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="editar-empresa-nome">Nome</Label>
        <Input id="editar-empresa-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="editar-empresa-cnpj">CNPJ</Label>
          <Input id="editar-empresa-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Plano</Label>
          <Select value={plano} onValueChange={(v) => setPlano(v as SubscriptionPlanSlug)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PLAN_LABEL) as SubscriptionPlanSlug[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Collapsible defaultOpen={temLimite}>
        <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
          Limites fora do plano
          <ChevronDown size={14} className="transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="editar-empresa-max-projetos">Projetos ativos</Label>
              <Input
                id="editar-empresa-max-projetos"
                type="number"
                min={0}
                placeholder="Padrão do plano"
                value={maxProjetos}
                onChange={(e) => setMaxProjetos(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-empresa-max-usuarios">Usuários</Label>
              <Input
                id="editar-empresa-max-usuarios"
                type="number"
                min={0}
                placeholder="Padrão do plano"
                value={maxUsuarios}
                onChange={(e) => setMaxUsuarios(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-ink-muted">Só pra caso negociado. Em branco, vale o limite do plano.</p>
        </CollapsibleContent>
      </Collapsible>
    </FormDialog>
  );
}

type AcaoNome = DialogBase & { empresaNome: string; onConfirm: (confirmName: string) => void };

export function SuspenderDialog(props: AcaoNome) {
  return (
    <ConfirmarComNome
      {...props}
      title={`Suspender ${props.empresaNome}?`}
      description="Todos os usuários perdem o acesso até você reativar. Nada é apagado."
      submitLabel="Suspender"
      destrutivo
    />
  );
}

export function ArquivarDialog(props: AcaoNome) {
  return (
    <ConfirmarComNome
      {...props}
      title={`Arquivar ${props.empresaNome}?`}
      description="A empresa sai das listas ativas e ninguém mais entra. Os dados ficam guardados: dá pra reativar, ou excluir de vez depois."
      submitLabel="Arquivar"
      destrutivo
    />
  );
}

export function ExcluirDialog({
  onConfirm,
  ...props
}: DialogBase & {
  empresaNome: string;
  onConfirm: (input: { confirmName: string; motivo: string }) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    if (!props.open) setMotivo("");
  }, [props.open]);
  return (
    <ConfirmarComNome
      {...props}
      title={`Excluir ${props.empresaNome} de vez?`}
      description="Não dá pra desfazer. Os logins e os dados de operação são apagados; lançamentos financeiros ficam anonimizados pelo prazo fiscal de 5 anos."
      submitLabel="Excluir empresa"
      destrutivo
      extraValido={!!motivo.trim()}
      onConfirm={(confirmName) => onConfirm({ confirmName, motivo: motivo.trim() })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="excluir-empresa-motivo">Motivo</Label>
        <Textarea
          id="excluir-empresa-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: conta de teste, pedido do cliente"
          rows={2}
        />
      </div>
    </ConfirmarComNome>
  );
}

export function TornarConvidadaDialog(props: AcaoNome) {
  return (
    <ConfirmarComNome
      {...props}
      title={`Tornar ${props.empresaNome} convidada?`}
      description="Passa a usar o Pilar sem pagar. O prazo de teste acaba, os avisos param e, se estiver só leitura, volta a editar na hora."
      submitLabel="Tornar convidada"
    />
  );
}

/** Prazo padrão ao começar a cobrar uma convidada (SPEC 104): parceira ganha folga pra decidir. */
const PRAZO_PADRAO = "7";

export function ComecarCobrarDialog({
  onConfirm,
  ...props
}: DialogBase & {
  empresaNome: string;
  onConfirm: (input: { confirmName: string; diasPrazo: number }) => void;
}) {
  const [dias, setDias] = useState(PRAZO_PADRAO);
  useEffect(() => {
    if (!props.open) setDias(PRAZO_PADRAO);
  }, [props.open]);
  const n = Number(dias);
  const valido = Number.isInteger(n) && n >= 1 && n <= 365;
  return (
    <ConfirmarComNome
      {...props}
      title={`Começar a cobrar ${props.empresaNome}?`}
      description="A empresa deixa de ser convidada e ganha um prazo pra assinar, com aviso de contagem regressiva. Sem assinatura no fim do prazo, fica só leitura."
      submitLabel="Começar a cobrar"
      extraValido={valido}
      onConfirm={(confirmName) => onConfirm({ confirmName, diasPrazo: n })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cobrar-dias">Prazo para assinar (dias)</Label>
        <Input
          id="cobrar-dias"
          type="number"
          min={1}
          max={365}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
        />
      </div>
    </ConfirmarComNome>
  );
}
