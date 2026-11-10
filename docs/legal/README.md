# Legal

Documentos legais e de privacidade. ← [voltar ao índice](../README.md)

| Documento                                    | Status                                      | O que é                                                                                                                |
| -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)     | ⚠️ Superado pela v2.0 ao vivo (2026-11-10)  | Rascunho antigo. A política publicada e completa é `apps/marketing/src/pages/Privacidade.tsx` (v2.0)                   |
| [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | ⚠️ Superado pela v2.0 ao vivo (2026-11-10)  | Rascunho antigo. O Termos publicado (v2.0, com o Anexo de Tratamento de Dados) é `apps/marketing/src/pages/Termos.tsx` |
| [COOKIE_POLICY.md](./COOKIE_POLICY.md)       | 🚧 Rascunho; tabela de cookies já publicada | A seção 7 de `/privacidade` (v2.0) traz a tabela de cookies; este texto longo ainda não tem página própria             |
| [SUBPROCESSADORES.md](./SUBPROCESSADORES.md) | ✅ v1, 2026-09-08                           | Lista pública dos fornecedores que processam dado pessoal em nome do Pilar                                             |
| [RIPD.md](./RIPD.md)                         | ✅ v1, 2026-10-13                           | Relatório de Impacto à Proteção de Dados: tratamento, riscos, controles e plano dos riscos residuais                   |

## Situação da identidade legal (CNPJ próprio pendente)

A Pilar hoje **não tem CNPJ próprio**: é uma iniciativa em processo de virar
pessoa jurídica separada (decisão de negócio, 2026-08-18). A marca é sempre
"Pilar" em toda a superfície visível ao usuário (produto, site, `/privacidade`,
`/termos`); não citamos mais Trinity Company nem Labrynth AI em nenhum lugar.

A LGPD (Art. 9) exige que a política de privacidade identifique o controlador
com razão social e CNPJ reais; um contrato (Termos de Uso) sem parte
identificada nem foro definido tem o mesmo problema, agravado por ser um
contrato, não só uma política informativa. `/privacidade` e `/termos` dizem
"Pilar" e qualificam razão social/CNPJ/foro como "em regularização", em vez de
inventar dados fictícios. **Risco aceito conscientemente pelo CEO** em duas
decisões (2026-08-18: publicar a marca Pilar sem CNPJ; hoje: publicar `/termos`
mesmo assim), não pendência esquecida.

Por isso:

- Quando o CNPJ, endereço e foro saírem, atualizar `src/pages/Termos.tsx` e
  `src/pages/Privacidade.tsx` com os dados reais (não os `.md` em `docs/legal/`
  diretamente, que são referência/rascunho, não o que está ao vivo).
- O **Termos de Uso** publicado ainda não passou por revisão de advogado (não
  cobre nuances contratuais específicas do setor nem tem foro definitivo).
  Contratar essa revisão continua pendente, agora com mais urgência por já
  estar ao vivo.
- E-mail de contato em `/privacidade`, `/termos` e nos documentos:
  `privacidade@pilarsoft.com.br`. Essa caixa precisa existir e ser monitorada:
  usuários já podem estar mandando pedido de exclusão/exportação de dados
  (LGPD Art. 18) pra ela a partir de agora.

### Revisão de 2026-11-10 (parecer LGPD)

- `/privacidade` reescrita (v2.0): papéis controlador/operador, base legal por dado, agentes de IA,
  todos os operadores com localização, transferência internacional dita como está (garantias do
  art. 33 em formalização), retenção conferida no código, tabela de cookies e os 12 direitos.
  Saíram duas afirmações falsas da v1: "hospedados em São Paulo" e "todos sob contrato com
  cláusulas LGPD".
- Google Tag Manager do app só carrega com consentimento de análise (`src/lib/gtm.ts`); antes
  carregava em toda página pelo `index.html`. Google Fonts trocado por Inter autohospedada.
- Aviso do áudio do Pilar Campo passa a dizer que a transcrição é feita por IA (Google Gemini).
- `/termos` v2.0 (vale para contas antigas a partir de 2026-12-10, cumprindo o aviso de 30 dias da
  v1): agentes de IA e responsabilidade técnica (ART/RRT), créditos de IA (cota do plano expira no
  ciclo, comprado não expira, desistência em 7 dias se não usado), acesso do suporte, teto de
  responsabilidade (12 meses pagos), reajuste com 30 dias, foro do domicílio do Cliente e o Anexo
  de Tratamento de Dados Pessoais (substitui o `DPA_TEMPLATE.md` como DPA padrão). `TERMS_VERSION`
  passou a 2.0.
- Portal do cliente, link de cotação e Pilar Campo mostram quem é o controlador e o link da política
  (`src/components/legal/AvisoPrivacidadeConvidado.tsx`).
- Obrigações novas que os Termos v2 criam e precisam de processo: avisar por e-mail os
  administradores 30 dias antes de reajuste, de mudança material e de fornecedor novo (Anexo A5), e
  avisar incidente ao Cliente em até 2 dias úteis (Anexo A8).
- Continua pendente (decisão ou contratação, não código): CNPJ, nome do encarregado, DPAs dos
  fornecedores com cláusulas-padrão da ANPD (Res. 19/2024) e revisão por advogado.

O **mecanismo técnico de consentimento de cookies já está ativo em produção**,
independente do CNPJ. Ver [SPEC 048](../specs/048-consentimento-cookies.md) e
[ADR 0022](../architecture/adr/0022-consentimento-cookies-client-side.md).

> Compliance operacional (SOC2, ISO, DPAs, ROPA) fica em [`../security/COMPLIANCE.md`](../security/COMPLIANCE.md).
