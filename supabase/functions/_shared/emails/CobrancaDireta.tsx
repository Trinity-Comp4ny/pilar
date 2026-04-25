import * as React from "react";
import { Hr, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  clienteNome: string;
  empresaNome: string;
  descricao: string;
  valorFormatado: string;
  dataVencimento: string;
  vencida: boolean;
  pixChave?: string;
  pixInstrucoes?: string;
}

export default function CobrancaDireta({
  clienteNome,
  empresaNome,
  descricao,
  valorFormatado,
  dataVencimento,
  vencida,
  pixChave,
  pixInstrucoes,
}: Props) {
  const accent = vencida ? t.red : t.brand;

  return (
    <BaseEmail
      preview={vencida ? `Fatura em atraso — ${valorFormatado}` : `Lembrete de pagamento — ${valorFormatado}`}
      footerNote={`Você recebeu esta cobrança de ${empresaNome} via Pilar.`}
    >
      {/* Título */}
      <Text style={styles.title}>
        {vencida ? (
          <>
            Fatura <span style={{ color: t.red }}>em atraso</span>
          </>
        ) : (
          <>
            <span style={styles.accent}>Lembrete</span> de pagamento
          </>
        )}
      </Text>

      <Text style={styles.intro}>
        Olá, <strong style={styles.strong}>{clienteNome}</strong>.{" "}
        {vencida
          ? "Identificamos que a fatura abaixo está vencida."
          : "Esta é uma cobrança referente ao serviço abaixo."}
      </Text>

      {/* Card de fatura */}
      <Section style={{ ...styles.card, borderLeft: `3px solid ${accent}` }}>
        <Text style={styles.label}>Descrição</Text>
        <Text style={styles.value}>{descricao}</Text>

        <Hr style={styles.cardDivider} />

        <Text style={styles.label}>Valor</Text>
        <Text style={{ ...styles.value, fontSize: 28, letterSpacing: "-0.02em" }}>{valorFormatado}</Text>

        <Hr style={styles.cardDivider} />

        <Text style={styles.label}>Vencimento</Text>
        <Text style={{ ...styles.value, color: vencida ? t.red : t.white }}>{dataVencimento}</Text>
      </Section>

      {/* Pix */}
      {pixChave && (
        <>
          <Text style={styles.label}>Chave Pix</Text>
          <Section style={styles.pixBox}>
            <Text style={styles.pixKey}>{pixChave}</Text>
          </Section>
          {pixInstrucoes && <Text style={styles.pixNote}>{pixInstrucoes}</Text>}
        </>
      )}

      <Hr style={styles.hr} />
      <Text style={styles.sender}>
        Enviado por <strong style={{ color: t.w65 }}>{empresaNome}</strong> via Pilar. Em caso de dúvida, responda este
        email.
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
  intro: {
    margin: "16px 0 0",
    fontSize: 15,
    lineHeight: "1.65",
    color: t.w65,
    fontFamily: t.font,
  },
  strong: { color: t.white },
  card: {
    backgroundColor: "#1C1C1C",
    borderRadius: 10,
    border: `1px solid ${t.w08}`,
    padding: "18px 20px",
    marginTop: 24,
  },
  cardDivider: { borderColor: t.w08, margin: "12px 0" },
  label: {
    margin: "0 0 3px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: t.w40,
    fontFamily: t.font,
  },
  value: {
    margin: "0 0 0",
    fontSize: 15,
    fontWeight: 600,
    color: t.white,
    fontFamily: t.font,
  },
  pixBox: {
    backgroundColor: "#1C1C1C",
    border: `1px solid ${t.w08}`,
    borderRadius: 8,
    padding: "12px 16px",
    marginTop: 8,
  },
  pixKey: {
    margin: 0,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 14,
    color: t.w65,
    wordBreak: "break-all",
  },
  pixNote: {
    margin: "8px 0 0",
    fontSize: 13,
    color: t.w40,
    fontFamily: t.font,
  },
  hr: { borderColor: t.w08, margin: "28px 0" },
  sender: {
    margin: 0,
    fontSize: 13,
    color: t.w40,
    fontFamily: t.font,
  },
};
