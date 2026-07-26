import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { formatPhone } from "@/lib/maskUtils";

const TARGET = "comercial@pilarsoft.com.br";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  defaultName?: string;
  currentPlan?: string;
};

export function FalarComercialDialog({ open, onOpenChange, defaultEmail = "", defaultName = "", currentPlan }: Props) {
  const [nome, setNome] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [telefone, setTelefone] = useState("");
  const [interesse, setInteresse] = useState<string>(currentPlan ?? "pro");
  const [mensagem, setMensagem] = useState("");

  const handleSend = () => {
    if (!nome.trim() || !email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    const subject = `Contato comercial — ${interesse.toUpperCase()}`;
    const body = [
      `Nome: ${nome}`,
      `Email: ${email}`,
      telefone ? `Telefone: ${telefone}` : "",
      `Interesse: plano ${interesse}`,
      "",
      "Mensagem:",
      mensagem || "(sem mensagem adicional)",
    ]
      .filter(Boolean)
      .join("\n");
    const url = `mailto:${TARGET}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast.success("Cliente de email aberto", { description: "Confirme o envio para o time comercial." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-foreground" />
            Falar com o comercial
          </DialogTitle>
          <DialogDescription>Conte como podemos ajudar. Retornamos em até 1 dia útil.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plano de interesse</Label>
              <Select value={interesse} onValueChange={setInteresse}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Como podemos ajudar?</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              placeholder="Conte um pouco sobre seu cenário, dores e o que está buscando."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} variant="brand">
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
