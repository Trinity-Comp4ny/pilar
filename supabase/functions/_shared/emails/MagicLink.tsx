import * as React from "react";
import { Button, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  link: string;
}

export default function MagicLink({ link }: Props) {
  return (
    <BaseEmail preview="Seu link de acesso ao Pilar">
      <Text style={styles.title}>
        Seu link de <span style={styles.accent}>acesso</span>
      </Text>
      <Text style={styles.body}>
        Clique abaixo para entrar no Pilar.{"\n"}O link é válido por <strong style={styles.strong}>1 hora</strong>.
      </Text>
      <Button href={link} style={styles.btn}>
        ACESSAR O PILAR
      </Button>
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
  strong: { color: t.white },
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
};
