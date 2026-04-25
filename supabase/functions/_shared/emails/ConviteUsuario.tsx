import * as React from "react";
import { Button, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  link: string;
  nome?: string;
}

export default function ConviteUsuario({ link, nome }: Props) {
  return (
    <BaseEmail preview={`Você foi convidado para o Pilar${nome ? `, ${nome}` : ""}`}>
      <Text style={styles.title}>
        Bem-vindo ao <span style={styles.accent}>Pilar</span>
      </Text>
      <Text style={styles.body}>
        {nome ? `Olá, ${nome}! ` : "Olá! "}
        Você foi convidado para acessar o Pilar.{"\n"}
        Configure sua conta pelo link abaixo.
      </Text>
      <Button href={link} style={styles.btn}>
        ACEITAR CONVITE
      </Button>
      <Text style={styles.hint}>O link expira em 24 horas.</Text>
    </BaseEmail>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 500,
    color: t.white,
    letterSpacing: "-0.02em",
    lineHeight: "1.2",
    fontFamily: t.font,
  },
  accent: { color: t.brand },
  body: {
    margin: "16px 0 0",
    fontSize: 15,
    lineHeight: "1.65",
    color: t.w65,
    fontFamily: t.font,
  },
  btn: {
    display: "inline-block",
    marginTop: 16,
    padding: "14px 32px",
    backgroundColor: t.brand,
    color: "#0D0D0D",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: "0.12em",
    borderRadius: 100,
    textDecoration: "none",
    fontFamily: t.font,
  },
  hint: {
    margin: "24px 0 0",
    fontSize: 13,
    color: t.w40,
    fontFamily: t.font,
  },
};
