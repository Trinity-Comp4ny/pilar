import { useEffect, useState } from "react";
import { monitoring } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Loader2, User, Building2, Landmark, Check } from "lucide-react";
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
import { useClientes, type Cliente, type ContaBancaria, type ChavePix } from "@/hooks/useClientes";
import { detectTipoChavePix, normalizarChavePix, TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";

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
  const [tipoNf, setTipoNf] = useState("");
  const [origem, setOrigem] = useState("");
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  const [chavesPix, setChavesPix] = useState<ChavePix[]>([]);
  const [newChavePix, setNewChavePix] = useState("");

  const [emailError, setEmailError] = useState("");
  const [cpfCnpjError, setCpfCnpjError] = useState("");

  const [step, setStep] = useState<1 | 2>(1);

  // Popula o formulário ao abrir. Em edição usa os dados do cliente; em criação
  // reseta tudo.
  useEffect(() => {
    if (!open) return;
    setStep(1);
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
      setTipoNf(cliente.tipo_nf || "");
      setOrigem(cliente.origem || "");
      setContasBancarias(Array.isArray(cliente.contas_bancarias) ? cliente.contas_bancarias : []);
      setChavesPix(Array.isArray(cliente.chaves_pix) ? cliente.chaves_pix : []);
    } else {
      setTipoPessoa("PF");
      setNome("");
      setSobrenome("");
      setCpfCnpj("");
      setEndereco("");
      setContato("");
      setEmail("");
      setTipoNf("");
      setOrigem("");
      setContasBancarias([]);
      setChavesPix([]);
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
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      const partes = [data.logradouro, data.bairro, data.localidade && `${data.localidade}/${data.uf}`].filter(Boolean);
      setEndereco(partes.join(", "));
    } catch (err) {
      monitoring.captureException(err, { context: "viaCepLookup" });
      toast.error("Não foi possível buscar o CEP");
    } finally {
      setIsFetchingCep(false);
    }
  };

  const validateFields = () => {
    let hasError = false;
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

  const goNext = () => {
    if (!nome.trim()) {
      toast.error(tipoPessoa === "PJ" ? "Preencha a razão social para continuar" : "Preencha o nome para continuar");
      return;
    }
    if (!validateFields()) return;
    setStep(2);
  };

  const goToStep = (target: 1 | 2) => {
    if (isEditMode) {
      setStep(target);
      return;
    }
    if (target < step) {
      setStep(target);
      return;
    }
    if (target === 2) goNext();
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
    if (!nome.trim()) {
      toast.error("Campos obrigatórios", {
        description: tipoPessoa === "PJ" ? "Preencha a razão social" : "Preencha o nome do cliente",
      });
      return;
    }
    if (!validateFields()) {
      if (step !== 1) setStep(1);
      return;
    }
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
          tipo_nf: tipoNf,
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

        {/* Stepper */}
        {(() => {
          const STEPS = [
            { id: 1 as const, label: "Identificação", icon: User },
            { id: 2 as const, label: "Financeiro", icon: Landmark },
          ];
          return (
            <div className="flex items-center gap-1 px-6 py-3 border-b">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isCompleted = step > s.id;
                const isClickable = isEditMode || s.id <= step;
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => isClickable && goToStep(s.id)}
                      disabled={!isClickable}
                      className={cn(
                        "flex items-center gap-2 flex-1 p-2 rounded-lg transition-colors text-left",
                        isClickable && "hover:bg-muted",
                        !isClickable && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                          isActive && "bg-brand text-ink",
                          isCompleted && "bg-brand text-ink",
                          !isActive && !isCompleted && "bg-muted text-muted-foreground"
                        )}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                      </span>
                      <div className="hidden sm:block min-w-0">
                        <p
                          className={cn(
                            "text-xs font-medium truncate",
                            isActive ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {s.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Passo {s.id}</p>
                      </div>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={cn("h-px flex-1 mx-1", step > s.id ? "bg-brand" : "bg-muted")} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <form onSubmit={(e) => e.preventDefault()} className="divide-y">
          {step === 1 && (
            <>
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
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "border-brand bg-brand/5 text-foreground"
                            : "border-input text-muted-foreground hover:bg-muted"
                        )}
                        aria-pressed={active}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {t === "PF" ? "Pessoa física" : "Pessoa jurídica"}
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
                      onChange={(e) => setNome(e.target.value)}
                      placeholder={isPJ ? "Razão social da empresa" : "Primeiro nome"}
                      required
                    />
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
                      className={cpfCnpjError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {cpfCnpjError && (
                      <p id="cliente-doc-error" role="alert" className="text-xs text-red-600">
                        {cpfCnpjError}
                      </p>
                    )}
                  </div>
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
                      className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {emailError && (
                      <p id="cliente-email-error" role="alert" className="text-xs text-red-600">
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
                </div>
              </div>

              {/* Comercial */}
              <div className="px-6 py-4 space-y-3">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Comercial</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cliente-tipoNf" className="text-xs">
                      Tipo de nota fiscal
                    </Label>
                    <Select value={tipoNf} onValueChange={setTipoNf}>
                      <SelectTrigger id="cliente-tipoNf">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="produto">Produto</SelectItem>
                        <SelectItem value="misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cliente-origem" className="text-xs">
                      Origem
                    </Label>
                    <Input
                      id="cliente-origem"
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value)}
                      placeholder="Ex: Indicação, Instagram, Site"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Contas Bancárias */}
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Contas bancárias</Label>
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
                    <Select value={newConta.tipo} onValueChange={(value) => setNewConta({ ...newConta, tipo: value })}>
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
                        key={index}
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
                              className={`h-4 w-4 ${conta.is_primary ? "text-brand" : "text-muted-foreground/40"}`}
                            />
                          </button>
                          <span className="font-medium truncate">{conta.banco}</span>
                          <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                            Ag. {conta.agencia} / Cc. {conta.conta}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize shrink-0">{conta.tipo}</span>
                          {conta.is_primary && <span className="text-[10px] text-brand font-medium">Principal</span>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 shrink-0"
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
              <div className="px-6 py-4 space-y-3">
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
                          className="ml-0.5 hover:text-red-500"
                          aria-label="Remover chave PIX"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 px-6 py-4 bg-gray-50/30">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <div className="flex-1" />
            {step === 2 && (
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSaving}>
                Voltar
              </Button>
            )}
            {step === 1 && !isEditMode ? (
              <Button type="button" onClick={goNext} className="bg-brand hover:bg-brand/90 text-ink">
                Próximo
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSave}
                className="bg-brand hover:bg-brand/90 text-ink"
                disabled={isSaving}
              >
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
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
