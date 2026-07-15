import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Pessoa } from "./types";
import { PessoaFormDialog } from "./components/PessoaFormDialog";
import { PessoaDetailDialog } from "./components/PessoaDetailDialog";
import { PessoaTable } from "./components/PessoaTable";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Pessoas() {
  usePageTitle("Equipe");
  const { canEdit: isAdmin } = useFeatureAccess("pessoas");
  const queryClient = useQueryClient();

  const {
    data: pessoas = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["pessoas"],
    queryFn: async () => {
      // Lê da view pessoas_safe: campos sensíveis (salário, contas, PIX, CPF
      // completo) vêm mascarados no banco para quem não tem can_view_folha().
      // Nunca confiar em ocultar no cliente. Escritas continuam na tabela.
      const { data, error } = await supabase
        .from("pessoas_safe" as never)
        .select("*")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as Pessoa[];
    },
  });

  useEffect(() => {
    if (fetchError) {
      toast.error("Erro ao carregar equipe", {
        description: fetchError.message,
      });
    }
  }, [fetchError]);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pessoaToDelete, setPessoaToDelete] = useState<{ id: string; nome: string } | null>(null);

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
    const pessoa = pessoas.find((p) => p.id === id);
    setPessoaToDelete({ id, nome: pessoa?.nome ?? "Pessoa" });
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pessoaToDelete) return;

    const { error } = await supabase
      .from("pessoas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", pessoaToDelete.id);
    if (!error) {
      toast.success("Pessoa excluída");
      setIsDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pessoas"] });
    } else {
      toast.error("Não foi possível excluir a pessoa. Tente novamente.");
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
          title="Equipe"
          description="Gerencie funcionários e terceirizados"
          children={
            isAdmin ? (
              <Button
                className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
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
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["pessoas"] })}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Pessoa"
        itemName={pessoaToDelete?.nome}
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}
