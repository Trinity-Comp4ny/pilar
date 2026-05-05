import * as React from "react";
import { Hr, Section, Text, Link } from "@react-email/components";
import { BaseEmail } from "./BaseEmail.tsx";
import { t } from "./tokens.ts";

interface Props {
  adminNome?: string;
  empresaNome: string;
  solicitanteEmail: string;
  solicitanteNome?: string;
  motivo?: string | null;
  requestedAt: string; // ISO ou formatado pt-BR
  adminPanelUrl: string;
  requestId: string;
}

export default function DataDeletionRequest({
  adminNome,
  empresaNome,
  solicitanteEmail,
  solicitanteNome,
  motivo,
  requestedAt,
  adminPanelUrl,
  requestId,
}: Props) {
  const saudacao = adminNome ? `Olá, ${adminNome}.` : "Olá.";

  return (
    <BaseEmail
      preview={`Nova solicitação de exclusão de dados — ${empresaNome}`}
      footerNote="Notificação automática enviada pelo Pilar para o admin responsável (LGPD Art. 18, IV)."
    >
      <Text style={styles.title}>
        Solicitação de <span style={styles.accent}>exclusão de dados</span>
      </Text>

      <Text style={styles.intro}>
        {saudacao} Um usuário da empresa <strong style={styles.strong}>{empresaNome}</strong> solicitou a eliminação dos
        próprios dados, conforme direito previsto no Art. 18, IV da LGPD.
      </Text>

      <Section style={styles.card}>
        <Text style={styles.label}>Solicitante</Text>
        <Text style={styles.value}>
          {solicitanteNome ? `${solicitanteNome} — ` : ""}
          {solicitanteEmail}
        </Text>

        <Hr style={styles.cardDivider} />

        <Text style={styles.label}>Solicitado em</Text>
        <Text style={styles.value}>{requestedAt}</Text>

        {motivo && (
          <>
            <Hr style={styles.cardDivider} />
            <Text style={styles.label}>Motivo informado</Text>
            <Text style={{ ...styles.value, fontWeight: 400, color: t.w65 }}>{motivo}</Text>
          </>
        )}

        <Hr style={styles.cardDivider} />

        <Text style={styles.label}>ID da solicitação</Text>
        <Text style={{ ...styles.value, fontFamily: "'Courier New', Courier, monospace", fontSize: 13 }}>
          {requestId}
        </Text>
      </Section>

      <Text style={styles.cta}>
        <Link href={adminPanelUrl} style={styles.link}>
          Abrir painel administrativo
        </Link>
      </Text>

      <Hr style={styles.hr} />

      <Text style={styles.note}>
        Você tem <strong style={styles.strong}>até 15 dias</strong> para processar a solicitação. Dados sujeitos a
        retenção legal (fiscal, auditoria) podem ser mantidos pelo prazo exigido — registre a justificativa no painel.
      </Text>
    </BaseEmail>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    margin: 0,
    fontSize: 26,
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
    borderLeft: `3px solid ${t.brand}`,
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
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: t.white,
    fontFamily: t.font,
  },
  cta: {
    margin: "28px 0 0",
    fontSize: 14,
    fontFamily: t.font,
  },
  link: {
    color: t.brand,
    textDecoration: "underline",
    fontWeight: 600,
  },
  hr: { borderColor: t.w08, margin: "28px 0" },
  note: {
    margin: 0,
    fontSize: 13,
    lineHeight: "1.65",
    color: t.w40,
    fontFamily: t.font,
  },
};
