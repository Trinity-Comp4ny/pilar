import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MARKETING_APP_URL } from "../marketing";

/**
 * Ficha do Marketing (SPEC 128, ADR 0061): a área vive na plataforma de marketing, produto
 * próprio. Aqui só o atalho para abrir e o que o Pilar troca com ela.
 */
export function MarketingExterno() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Campanhas, posts e vídeos ficam na plataforma de marketing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Lá você aprova e agenda posts, acompanha campanhas, vídeos e o alcance de cada rede, e vê quais posts
            trouxeram cadastro e cliente.
          </p>
          <Button asChild variant="brand">
            <a href={MARKETING_APP_URL} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              Abrir plataforma de marketing
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">O que o Pilar manda para lá</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>Cadastros, ativados e pagantes por link publicado, pela UTM do cadastro.</li>
            <li>Só contagem: nenhum nome, e-mail ou dado de escritório sai do Pilar.</li>
            <li>Token de integração próprio, que dá para trocar sem mexer no resto.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
