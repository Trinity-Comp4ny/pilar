import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { formatCPF, formatPhone, formatAgency, formatBankAccount } from "@/lib/maskUtils";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Pessoa } from "./types";
import { PessoaFormDialog } from "./components/PessoaFormDialog";
import { PessoaDetailDialog } from "./components/PessoaDetailDialog";
import { PessoaTable } from "./components/PessoaTable";

export default function Pessoas() {
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const { toast } = useToast();

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pessoaToDelete, setPessoaToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchPessoas();
  }, []);

  const fetchPessoas = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("pessoas").select("*").order("nome");
    if (data) {
      setPessoas(data as unknown as Pessoa[]);
    }
    setIsLoading(false);
  };

  const handleNewPessoa = () => {
    setEditingPessoa(null);
    setIsFormDialogOpen(true);
  };

  const handleEditClick = (pessoa: Pessoa, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingPessoa(pessoa);
    setIsDetailOpen(false);
    setIsFormDialogOpen(true);
  };

  const handleRowClick = (pessoa: Pessoa) => {
    setSelectedPessoa(pessoa);
    setIsDetailOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setPessoaToDelete(id);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pessoaToDelete) return;

    const { error } = await supabase.from("pessoas").delete().eq("id", pessoaToDelete);
    if (!error) {
      toast({ title: "Pessoa excluída" });
      setIsDetailOpen(false);
      fetchPessoas();
    }
    setConfirmDeleteOpen(false);
    setPessoaToDelete(null);
  };

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Pessoas"
          description="Gerencie funcionários e terceirizados"
          children={
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Pessoa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? 'Atualize os dados da pessoa' : 'Cadastre um novo funcionário ou terceirizado'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tipo_contrato">Tipo de Contrato *</Label>
                    <Select 
                      value={formData.tipo_contrato} 
                      onValueChange={(value) => handleInputChange("tipo_contrato", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contratado">Contratado (CLT/PJ)</SelectItem>
                        <SelectItem value="terceirizado">Terceirizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => handleInputChange("nome", e.target.value)}
                      placeholder="Nome completo"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => handleInputChange("cpf", formatCPF(e.target.value))}
                      maxLength={14}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cargo">Cargo/Função *</Label>
                    <Input
                      id="cargo"
                      value={formData.cargo}
                      onChange={(e) => handleInputChange("cargo", e.target.value)}
                      placeholder="Ex: Arquiteto, Pedreiro"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange("endereco", e.target.value)}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone/Celular</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange("telefone", formatPhone(e.target.value))}
                        maxLength={15}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="data_admissao">Data de Admissão</Label>
                      <Input
                        id="data_admissao"
                        type="date"
                        value={formData.data_admissao}
                        onChange={(e) => handleInputChange("data_admissao", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_demissao">Data de Demissão</Label>
                      <Input
                        id="data_demissao"
                        type="date"
                        value={formData.data_demissao}
                        onChange={(e) => handleInputChange("data_demissao", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="salario_fixo">Salário Fixo (R$)</Label>
                      <Input
                        id="salario_fixo"
                        type="text"
                        value={formData.salario_fixo}
                        onChange={(e) => handleInputChange("salario_fixo", formatCurrencyInput(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor_m2">Valor m² (R$)</Label>
                      <Input
                        id="valor_m2"
                        type="text"
                        value={formData.valor_m2}
                        onChange={(e) => handleInputChange("valor_m2", formatCurrencyInput(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 md:col-span-2 mt-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>Contas Bancárias</Label>
                      <span className="text-xs text-black/50">Cadastre uma ou mais contas para pagamento</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
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
                          placeholder="0000-0"
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
                          className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full h-9 w-9"
                          onClick={handleAddConta}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {contasBancarias.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-black/60">Contas cadastradas</Label>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {contasBancarias.map((conta, index) => (
                            <div
                              key={index}
                              className={`flex items-center justify-between gap-3 bg-gray-50 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? 'border-accent-orange/50 bg-accent-orange/5' : 'border-gray-200'}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => handleSetPrimaryConta(index)}
                                  title="Definir como principal"
                                >
                                  <Landmark className={`h-4 w-4 ${conta.is_primary ? 'text-accent-orange fill-accent-orange' : 'text-gray-400'}`} />
                                </Button>
                                <span className="font-medium truncate">{conta.banco}</span>
                                <span className="hidden md:inline text-xs text-black/60 flex-shrink-0">
                                  Ag. {conta.agencia} / Cc. {conta.conta}
                                </span>
                                <span className="text-xs text-black/50 capitalize flex-shrink-0">
                                  {conta.tipo}
                                </span>
                                {conta.is_primary && (
                                  <span className="text-[10px] bg-accent-orange/10 text-accent-orange px-1.5 py-0.5 rounded">Principal</span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 flex-shrink-0"
                                onClick={() => handleRemoveConta(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-4 md:col-span-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-white">
                      {isEditMode ? 'Atualizar' : 'Salvar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          }
        />
      }
    >
      <PessoaTable
        pessoas={pessoas}
        isLoading={isLoading}
        isAdmin={isAdmin}
        onRowClick={handleRowClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <PessoaDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        pessoa={selectedPessoa}
        isAdmin={isAdmin}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <PessoaFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        editPessoa={editingPessoa}
        onSaved={fetchPessoas}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Pessoa"
        description="Tem certeza que deseja excluir esta pessoa? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}
