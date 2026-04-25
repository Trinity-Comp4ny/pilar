import * as React from "react";
import { Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  mensagem: string;
}

export default function MensagemManual({ mensagem }: Props) {
  const linhas = mensagem.split("\n");
  return (
    <BaseEmail>
      {linhas.map((linha, i) => (
        <Text key={i} style={styles.linha}>
          {linha || " "}
        </Text>
      ))}
    </BaseEmail>
  );
}

const styles: Record<string, React.CSSProperties> = {
  linha: {
    margin: "0 0 8px",
    fontSize: 15,
    lineHeight: "1.65",
    color: t.w65,
    fontFamily: t.font,
  },
};
