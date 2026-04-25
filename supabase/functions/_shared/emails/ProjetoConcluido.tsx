import * as React from "react";
import { Hr, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  projetoNome: string;
}

export default function ProjetoConcluido({ projetoNome }: Props) {
  return (
    <BaseEmail preview={`Projeto ${projetoNome} concluído`}>
      <Text style={styles.title}>
        Projeto <span style={styles.accent}>concluído</span>
      </Text>
      <Text style={styles.body}>
        O projeto <strong style={styles.strong}>{projetoNome}</strong> foi marcado como{" "}
        <strong style={styles.strong}>Concluído</strong>.
      </Text>
      <Hr style={styles.hr} />
      <Text style={styles.hint}>Entre em contato com a equipe caso tenha alguma dúvida.</Text>
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
  hr: {
    borderColor: t.w08,
    margin: "28px 0",
  },
  hint: {
    margin: 0,
    fontSize: 13,
    color: t.w40,
    fontFamily: t.font,
  },
};
