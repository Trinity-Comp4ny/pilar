import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
            isAdmin ? (
              <Button
                className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white transition-colors px-5 py-2.5 text-sm"
                onClick={handleNewPessoa}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Pessoa
              </Button>
            ) : undefined
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
