import * as React from "react";
import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";
import { t } from "./tokens.ts";

interface BaseEmailProps {
  preview?: string;
  footerNote?: string;
  children: React.ReactNode;
}

export function BaseEmail({ preview, footerNote, children }: BaseEmailProps) {
  const note = footerNote ?? "Você recebeu este email por estar associado a um projeto no Pilar.";
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body style={styles.body}>
        <Container style={styles.wrapper}>
          {/* ── Header: logo + wordmark + dot grid ── */}
          <Section style={styles.header}>
            <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  {/* Logo pill branco */}
                  <td style={styles.logoPill}>
                    <Img src={t.logo} width={18} height={18} alt="" style={{ display: "block" }} />
                  </td>
                  <td style={{ paddingLeft: 10, verticalAlign: "middle" }}>
                    <span style={styles.wordmark}>Pilar</span>
                    <sup style={styles.registered}>®</sup>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Conteúdo ── */}
          <Section style={styles.content}>{children}</Section>

          {/* ── Footer ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerNote}>{note}</Text>
            <Text style={styles.footerDomain}>pilarsoft.com.br</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: t.bg,
    margin: 0,
    padding: "48px 16px 64px",
    fontFamily: t.font,
  },
  wrapper: {
    maxWidth: 560,
    backgroundColor: t.card,
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${t.w08}`,
  },
  header: {
    backgroundColor: t.header,
    backgroundImage: "radial-gradient(circle,rgba(164,236,134,0.07) 1px,transparent 1px)",
    backgroundSize: "28px 28px",
    padding: "22px 32px",
    borderBottom: `1px solid ${t.w08}`,
  },
  logoPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    padding: "5px 6px",
    width: 30,
    height: 30,
    verticalAlign: "middle",
    lineHeight: "0",
  },
  wordmark: {
    fontSize: 16,
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "-0.02em",
    fontFamily: t.font,
  },
  registered: {
    fontSize: 8,
    fontWeight: 400,
    color: t.w40,
    marginLeft: 2,
    verticalAlign: "super",
  },
  content: {
    backgroundColor: t.card,
    padding: "40px 32px 36px",
  },
  footer: {
    backgroundColor: t.header,
    padding: "18px 32px",
    borderTop: `1px solid ${t.w08}`,
  },
  footerNote: {
    margin: 0,
    fontSize: 12,
    lineHeight: "1.7",
    color: t.w40,
    fontFamily: t.font,
  },
  footerDomain: {
    margin: "4px 0 0",
    fontSize: 11,
    color: t.w20,
    letterSpacing: "0.05em",
    fontFamily: t.font,
  },
};
