import * as React from "react";
import { Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  nomePessoa: string;
  projetoNome: string;
  disciplinaConcluida: string;
  suaDisciplina: string;
}

export default function ProximaEtapa({ nomePessoa, projetoNome, disciplinaConcluida, suaDisciplina }: Props) {
  return (
    <BaseEmail preview={`Sua disciplina ${suaDisciplina} pode começar`}>
      <Text style={styles.title}>
        Sua vez, <span style={styles.accent}>{nomePessoa}</span>!
      </Text>
      <Text style={styles.body}>
        A etapa <strong style={styles.strong}>{disciplinaConcluida}</strong> do projeto{" "}
        <strong style={styles.strong}>{projetoNome}</strong> foi concluída.
      </Text>
      <Text style={{ ...styles.body, marginTop: 12 }}>
        Sua disciplina <strong style={styles.strong}>{suaDisciplina}</strong> pode começar agora.
      </Text>
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
};
