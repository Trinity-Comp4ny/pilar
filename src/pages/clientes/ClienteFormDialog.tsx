import { useEffect, useState } from "react";
import { monitoring } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, X, Loader2, User, Building2, Landmark, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  formatPhone,
  formatDocument,
  formatCNPJ,
  formatCPF,
  formatAgency,
  formatBankAccount,
  validateEmail,
  validateCPF,
  validateCNPJ,
  onlyDigits,
} from "@/lib/maskUtils";
import { Badge } from "@/components/ui/badge";
import { OrigemField } from "@/components/forms/OrigemField";
import { useClientes, type Cliente, type ContaBancaria, type ChavePix } from "@/hooks/useClientes";
import { detectTipoChavePix, normalizarChavePix, TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import { lookupCEP } from "@/lib/brasilApi";

type TipoPessoa = "PF" | "PJ";

// Máscara de CEP local (00000-000). Fica aqui para não tocar em maskUtils.
const formatCEP = (value: string): string => {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

// Valida documento exigindo exatamente 11 (CPF) ou 14 (CNPJ) dígitos.
const getDocError = (raw: string, tipo: TipoPessoa): string => {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (tipo === "PF") {
    if (digits.length !== 11) return "CPF deve ter 11 dígitos";
    return validateCPF(digits) ? "" : "CPF inválido";
  }
  if (digits.length !== 14) return "CNPJ deve ter 14 dígitos";
  return validateCNPJ(digits) ? "" : "CNPJ inválido";
};

interface ClienteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
  onSaved?: () => void;
}

export function ClienteFormDialog({ open, onOpenChange, cliente, onSaved }: ClienteFormDialogProps) {
  const { upsertCliente, isSaving } = useClientes();
  const isEditMode = !!cliente;

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PF");
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("");
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  const [chavesPix, setChavesPix] = useState<ChavePix[]>([]);
  const [newChavePix, setNewChavePix] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  const [nomeError, setNomeError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cpfCnpjError, setCpfCnpjError] = useState("");

  // Popula o formulário ao abrir. Em edição usa os dados do cliente; em criação
  // reseta tudo.
  useEffect(() => {
    if (!open) return;
    setNomeError("");
    setEmailError("");
    setCpfCnpjError("");
    setCep("");
    if (cliente) {
      const docDigits = onlyDigits(cliente.cpf_cnpj ?? "");
      const inferred: TipoPessoa =
        cliente.tipo_pessoa === "PF" || cliente.tipo_pessoa === "PJ"
          ? cliente.tipo_pessoa
          : docDigits.length === 14
            ? "PJ"
            : "PF";
      setTipoPessoa(inferred);
      setNome(cliente.nome);
      setSobrenome(cliente.sobrenome ?? "");
      setCpfCnpj(cliente.cpf_cnpj ? formatDocument(cliente.cpf_cnpj) : "");
      setEndereco(cliente.endereco || "");
      setContato(cliente.contato || "");
      setEmail(cliente.email || "");
      setOrigem(cliente.origem || "");
      const contas = Array.isArray(cliente.contas_bancarias) ? cliente.contas_bancarias : [];
      const pix = Array.isArray(cliente.chaves_pix) ? cliente.chaves_pix : [];
      setContasBancarias(contas);
      setChavesPix(pix);
      setBankOpen(contas.length > 0 || pix.length > 0);
    } else {
      setTipoPessoa("PF");
      setNome("");
      setSobrenome("");
      setCpfCnpj("");
      setEndereco("");
      setContato("");
      setEmail("");
      setOrigem("");
      setContasBancarias([]);
      setChavesPix([]);
      setBankOpen(false);
    }
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setNewChavePix("");
  }, [open, cliente]);

  const handleTipoPessoa = (tipo: TipoPessoa) => {
    setTipoPessoa(tipo);
    if (cpfCnpjError) setCpfCnpjError("");
    if (tipo === "PJ") setSobrenome("");
    // Reaplica a máscara conforme o tipo escolhido.
    setCpfCnpj((prev) => {
      const d = onlyDigits(prev);
      if (!d) return "";
      return tipo === "PF" ? formatCPF(d) : formatCNPJ(d);
    });
  };

  const handleCepBlur = async () => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const end = await lookupCEP(digits);
      if (!end) {
        toast.error("CEP não encontrado");
        return;
      }
      const partes = [end.street, end.neighborhood, end.city && `${end.city}/${end.state}`].filter(Boolean);
      setEndereco(partes.join(", "));
    } finally {
      setIsFetchingCep(false);
    }
  };

  const validateFields = () => {
    let hasError = false;
    if (!nome.trim()) {
      setNomeError(tipoPessoa === "PJ" ? "Informe a razão social" : "Informe o nome");
      hasError = true;
    } else {
      setNomeError("");
    }
    if (email && !validateEmail(email)) {
      setEmailError("E-mail inválido");
      hasError = true;
    } else {
      setEmailError("");
    }
    const docError = getDocError(cpfCnpj, tipoPessoa);
    if (docError) {
      setCpfCnpjError(docError);
      hasError = true;
    } else {
      setCpfCnpjError("");
    }
    return !hasError;
  };

  const handleAddConta = () => {
    if (!newConta.banco || !newConta.agencia || !newConta.conta) {
      toast.error("Dados incompletos", { description: "Preencha banco, agência e conta antes de adicionar" });
      return;
    }
    const isFirst = contasBancarias.length === 0;
    setContasBancarias((prev) => [...prev, { ...newConta, is_primary: isFirst }]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  };

  const handleAddChavePix = () => {
    const raw = newChavePix.trim();
    if (!raw) return;
    const tipo = detectTipoChavePix(raw);
    if (!tipo) {
      toast.error("Chave inválida", { description: "Formato não reconhecido como chave PIX" });
      return;
    }
    const chave = normalizarChavePix(raw, tipo);
    if (chavesPix.some((c) => c.chave === chave)) {
      toast.error("Chave duplicada", { description: "Esta chave já foi adicionada" });
      return;
    }
    setChavesPix((prev) => [...prev, { chave, tipo }]);
    setNewChavePix("");
  };

  const handleRemoveChavePix = (index: number) => {
    setChavesPix((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryConta = (index: number) => {
    setContasBancarias((prev) => prev.map((conta, i) => ({ ...conta, is_primary: i === index })));
  };

  const handleRemoveConta = (index: number) => {
    setContasBancarias((prev) => {
      const newContas = prev.filter((_, i) => i !== index);
      if (prev[index].is_primary && newContas.length > 0) {
        newContas[0].is_primary = true;
      }
      return newContas;
    });
  };

  const handleSave = async () => {
    if (!validateFields()) return;
    try {
      await upsertCliente({
        id: isEditMode && cliente ? cliente.id : undefined,
        data: {
          tipo_pessoa: tipoPessoa,
          nome,
          sobrenome: tipoPessoa === "PJ" ? "" : sobrenome,
          cpf_cnpj: cpfCnpj,
          endereco,
          contato,
          email,
          origem,
          contas_bancarias: contasBancarias,
          chaves_pix: chavesPix,
        },
      });
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      monitoring.captureException(err, { context: "handleSaveCliente" });
    }
  };

  const isPJ = tipoPessoa === "PJ";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Atualize os dados do cliente" : "Cadastre um novo cliente no sistema"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="divide-y">
          {/* Identificação */}
          <div className="px-6 py-4 space-y-3">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Identificação</Label>

            {/* Seletor PF / PJ */}
            <div className="grid grid-cols-2 gap-2">
              {(["PF", "PJ"] as const).map((t) => {
                const active = tipoPessoa === t;
                const Icon = t === "PF" ? User : Building2;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTipoPessoa(t)}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition-colors",
                      active ? "border-brand bg-brand/5" : "border-input hover:bg-muted"
                    )}
                    aria-pressed={active}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        active ? "bg-brand text-ink" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                        {t === "PF" ? "Pessoa física" : "Pessoa jurídica"}
                      </p>
                      <p className="text-xs text-muted-foreground">{t === "PF" ? "CPF" : "CNPJ"}</p>
                    </div>
                    {active && <Check className="absolute right-3 top-3 h-4 w-4 text-brand" />}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={cn("space-y-1.5", isPJ && "md:col-span-2")}>
                <Label htmlFor="cliente-nome" className="text-xs">
                  {isPJ ? "Razão social *" : "Nome *"}
                </Label>
                <Input
                  id="cliente-nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (nomeError) setNomeError("");
                  }}
                  placeholder={isPJ ? "Razão social da empresa" : "Primeiro nome"}
                  required
                  aria-invalid={!!nomeError}
                  aria-describedby={nomeError ? "cliente-nome-error" : undefined}
                  className={nomeError ? "border-danger-strong focus-visible:ring-danger-strong" : ""}
                />
                {nomeError && (
                  <p id="cliente-nome-error" role="alert" className="text-xs text-danger-mid">
                    {nomeError}
                  </p>
                )}
              </div>
              {!isPJ && (
                <div className="space-y-1.5">
                  <Label htmlFor="cliente-sobrenome" className="text-xs">
                    Sobrenome
                  </Label>
                  <Input
                    id="cliente-sobrenome"
                    value={sobrenome}
                    onChange={(e) => setSobrenome(e.target.value)}
                    placeholder="Sobrenome"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cliente-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="cliente-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  placeholder="email@exemplo.com"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "cliente-email-error" : undefined}
                  className={emailError ? "border-danger-strong focus-visible:ring-danger-strong" : ""}
                />
                {emailError && (
                  <p id="cliente-email-error" role="alert" className="text-xs text-danger-mid">
                    {emailError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliente-contato" className="text-xs">
                  Telefone
                </Label>
                <Input
                  id="cliente-contato"
                  value={contato}
                  onChange={(e) => setContato(formatPhone(e.target.value))}
                  maxLength={15}
                  placeholder="(14) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliente-doc" className="text-xs">
                  {isPJ ? "CNPJ" : "CPF"}
                </Label>
                <Input
                  id="cliente-doc"
                  value={cpfCnpj}
                  onChange={(e) => {
                    setCpfCnpj(isPJ ? formatCNPJ(e.target.value) : formatCPF(e.target.value));
                    if (cpfCnpjError) setCpfCnpjError("");
                  }}
                  placeholder={isPJ ? "00.000.000/0000-00" : "000.000.000-00"}
                  maxLength={isPJ ? 18 : 14}
                  inputMode="numeric"
                  aria-invalid={!!cpfCnpjError}
                  aria-describedby={cpfCnpjError ? "cliente-doc-error" : undefined}
                  className={cpfCnpjError ? "border-danger-strong focus-visible:ring-danger-strong" : ""}
                />
                {cpfCnpjError && (
                  <p id="cliente-doc-error" role="alert" className="text-xs text-danger-mid">
                    {cpfCnpjError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliente-cep" className="text-xs">
                  CEP
                </Label>
                <div className="relative">
                  <Input
                    id="cliente-cep"
                    value={cep}
                    onChange={(e) => setCep(formatCEP(e.target.value))}
                    onBlur={handleCepBlur}
                    maxLength={9}
                    inputMode="numeric"
                    placeholder="00000-000"
                  />
                  {isFetchingCep && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="cliente-endereco" className="text-xs">
                  Endereço
                </Label>
                <Input
                  id="cliente-endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Logradouro, número, bairro, cidade/UF"
                />
              </div>
              <OrigemField id="cliente-origem" value={origem} onChange={setOrigem} />
            </div>
          </div>

          {/* Dados bancários — opcional, só importa na hora de faturar */}
          <div className="px-6">
            <Collapsible open={bankOpen} onOpenChange={setBankOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between py-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-medium uppercase tracking-wider">Dados bancários (opcional)</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", bankOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-4 space-y-4">
                {/* Contas Bancárias */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                      Contas bancárias
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Para recebimento</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Banco</Label>
                      <Input
                        placeholder="Nome do banco"
                        value={newConta.banco}
                        onChange={(e) => setNewConta({ ...newConta, banco: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Agência</Label>
                      <Input
                        placeholder="0000"
                        value={newConta.agencia}
                        onChange={(e) => setNewConta({ ...newConta, agencia: formatAgency(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Conta</Label>
                      <Input
                        placeholder="000000-0"
                        value={newConta.conta}
                        onChange={(e) => setNewConta({ ...newConta, conta: formatBankAccount(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Select
                        value={newConta.tipo}
                        onValueChange={(value) => setNewConta({ ...newConta, tipo: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corrente">Corrente</SelectItem>
                          <SelectItem value="poupanca">Poupança</SelectItem>
                          <SelectItem value="pj">PJ</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0"
                        onClick={handleAddConta}
                        aria-label="Adicionar conta"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {contasBancarias.length > 0 && (
                    <div className="space-y-1.5">
                      {contasBancarias.map((conta, index) => (
                        <div
                          key={`${conta.banco}|${conta.agencia}|${conta.conta}|${index}`}
                          className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? "border-brand/40" : ""}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              type="button"
                              className="shrink-0"
                              onClick={() => handleSetPrimaryConta(index)}
                              title="Definir como principal"
                            >
                              <Landmark
                                className={`h-4 w-4 ${conta.is_primary ? "text-foreground" : "text-muted-foreground/40"}`}
                              />
                            </button>
                            <span className="font-medium truncate">{conta.banco}</span>
                            <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                              Ag. {conta.agencia} / Cc. {conta.conta}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize shrink-0">{conta.tipo}</span>
                            {conta.is_primary && (
                              <span className="text-[10px] text-foreground font-medium">Principal</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-danger-mid shrink-0"
                            onClick={() => handleRemoveConta(index)}
                            aria-label="Remover conta"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chaves PIX */}
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Chaves PIX</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                        value={newChavePix}
                        onChange={(e) => setNewChavePix(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddChavePix())}
                      />
                      {newChavePix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {(() => {
                            const t = detectTipoChavePix(newChavePix);
                            return t ? TIPO_CHAVE_PIX_LABEL[t] : "...";
                          })()}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0"
                      onClick={handleAddChavePix}
                      aria-label="Adicionar chave PIX"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {chavesPix.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {chavesPix.map((c, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs">
                          <select
                            value={c.tipo}
                            onChange={(e) =>
                              setChavesPix((prev) =>
                                prev.map((item, idx) => (idx === i ? { ...item, tipo: e.target.value } : item))
                              )
                            }
                            className="text-[10px] text-muted-foreground bg-transparent border-none outline-none cursor-pointer hover:text-foreground transition-colors appearance-none"
                          >
                            {Object.entries(TIPO_CHAVE_PIX_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <span className="font-medium">{c.chave}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChavePix(i)}
                            className="ml-0.5 hover:text-danger-mid"
                            aria-label="Remover chave PIX"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-6 py-4 bg-muted/30">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <div className="flex-1" />
            <Button type="button" onClick={handleSave} variant="brand" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : isEditMode ? (
                "Atualizar"
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
