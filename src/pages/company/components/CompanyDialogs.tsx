import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLES } from "../types";

interface LogoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingLogoFile: File | null;
  logoUrl?: string;
}

export function LogoPreviewDialog({ open, onOpenChange, pendingLogoFile, logoUrl }: LogoPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Logo da empresa</DialogTitle>
          <DialogDescription>Pré-visualização ampliada.</DialogDescription>
        </DialogHeader>
        <div className="bg-black/5 border border-black/10 rounded-xl p-6 flex items-center justify-center min-h-[320px]">
          {pendingLogoFile ? (
            <img
              src={URL.createObjectURL(pendingLogoFile)}
              alt="Logo (prévia)"
              className="max-h-[520px] w-full object-contain"
            />
          ) : logoUrl ? (
            <img src={logoUrl} alt="Logo" className="max-h-[520px] w-full object-contain" />
          ) : (
            <span className="text-sm text-black/50">Nenhuma logo enviada</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  lastName: string;
  contact: string;
  role: (typeof ROLES)[number];
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onContactChange: (v: string) => void;
  onRoleChange: (v: (typeof ROLES)[number]) => void;
  onSave: () => void;
}

export function EditUserDialog({
  open,
  onOpenChange,
  firstName,
  lastName,
  contact,
  role,
  onFirstNameChange,
  onLastNameChange,
  onContactChange,
  onRoleChange,
  onSave,
}: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>Altere o nome, contato e função do usuário.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="Nome" required />
          </div>
          <div className="space-y-2">
            <Label>Sobrenome *</Label>
            <Input
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              placeholder="Sobrenome"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Contato</Label>
            <Input value={contact} onChange={(e) => onContactChange(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={role} onValueChange={(v) => onRoleChange(v as (typeof ROLES)[number])}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={onSave} className="rounded-full bg-brand hover:bg-brand/90 text-ink">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteUserDialog({ open, onOpenChange, onConfirm }: DeleteUserDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso removerá o perfil do usuário da sua empresa. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
