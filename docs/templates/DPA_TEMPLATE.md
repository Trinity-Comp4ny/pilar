# DPA (Data Processing Agreement) — Template

**Status:** 🚧 Rascunho de referência, nunca assinado com cliente real (zero pagante hoje, ver
`docs/strategy/DECISOES.md` 2026-09-01). **Não enviar a cliente sem revisão de advogado** — este
template cobre a estrutura padrão de mercado, não foi validado juridicamente para o contexto
brasileiro específico do Pilar.

**Quando usar:** anexo obrigatório ao contrato comercial (Termos de Uso) de todo cliente que
processa dado pessoal de terceiros através do Pilar — ou seja, todo cliente, já que
`clientes`, `cliente_portal_accounts` e `pessoas`/`folha_pagamento` sempre têm dado pessoal. Sem
CNPJ próprio da Pilar (ver `docs/legal/README.md`), este documento não pode ser assinado de
verdade ainda: os campos entre colchetes só saem "[A PREENCHER]" quando a pessoa jurídica sair.

---

## Anexo de Processamento de Dados

Este Anexo de Processamento de Dados ("DPA") complementa o contrato de prestação de serviço
("Contrato") entre **[RAZÃO SOCIAL DA PILAR, A PREENCHER], CNPJ [A PREENCHER]** ("Operador",
"Pilar") e **[RAZÃO SOCIAL DO CLIENTE]**, CNPJ **[CNPJ DO CLIENTE]** ("Controlador", "Cliente").
Em caso de conflito entre este Anexo e o Contrato quanto a proteção de dados pessoais, prevalece
este Anexo.

### 1. Definições

- **Dado Pessoal**: qualquer informação relacionada a pessoa natural identificada ou
  identificável, conforme Art. 5º, I da LGPD (Lei 13.709/2018).
- **Tratamento**: qualquer operação com Dado Pessoal (coleta, uso, acesso, armazenamento,
  eliminação), conforme Art. 5º, X da LGPD.
- **Titular**: a pessoa natural a quem o Dado Pessoal se refere — funcionário do Cliente,
  cliente final do Cliente, ou qualquer terceiro cujo dado o Cliente insira na Plataforma.
- **Subprocessador**: terceiro contratado pelo Operador para auxiliar no Tratamento, listado em
  `docs/legal/SUBPROCESSADORES.md` (lista viva, atualizada conforme a seção 6 abaixo).

### 2. Papéis

O Cliente é **Controlador** dos Dados Pessoais que insere na Plataforma (dados de seus
funcionários, clientes finais e fornecedores). O Pilar é **Operador**, tratando esses dados
exclusivamente conforme instrução documentada do Cliente (uso normal da Plataforma) e para as
finalidades descritas no [ROPA](../ROPA.md).

Para os dados da própria relação comercial (cadastro do Cliente, cobrança da assinatura), o
Pilar é **Controlador**.

### 3. Objeto e escopo do tratamento

- **Natureza e finalidade:** operação da Plataforma Pilar (gestão de projeto, financeiro, RH,
  portal do cliente, diário de obra), conforme descrito no Contrato.
- **Categorias de Titular:** funcionários do Cliente, clientes finais do Cliente, fornecedores
  pessoa física, visitantes do portal do cliente.
- **Categorias de Dado:** ver [ROPA](../ROPA.md), tabela "Atividades de tratamento" —
  identificação, contato, dado financeiro/folha quando aplicável, dado de uso do produto.
- **Duração:** enquanto o Contrato estiver vigente + prazos de retenção legal aplicáveis (ver
  ROPA, coluna "Retenção").

### 4. Obrigações do Operador (Pilar)

O Pilar se compromete a:

1. Tratar Dado Pessoal apenas conforme instrução documentada do Cliente e para as finalidades
   deste Anexo — nunca para finalidade própria não descrita aqui.
2. Garantir que toda pessoa autorizada a tratar o dado esteja sob obrigação de
   confidencialidade.
3. Adotar medidas técnicas e organizacionais de segurança compatíveis com o risco — ver
   `docs/security/SECURITY.md` (RLS por `empresa_id`, criptografia em trânsito, MFA
   administrativo, log de auditoria imutável).
4. Auxiliar o Cliente a responder solicitação de Titular (acesso, correção, exclusão,
   portabilidade) — já implementado como autoatendimento em Configurações → Privacidade
   (`request_data_export`/`request_data_deletion`), com resposta em até 15 dias.
5. Notificar o Cliente sem atraso indevido em caso de incidente de segurança envolvendo Dado
   Pessoal, seguindo o prazo e o processo de `docs/operations/INCIDENT_RESPONSE.md`.
6. Ao término do Contrato, devolver ou eliminar todo Dado Pessoal, conforme escolha do Cliente,
   salvo obrigação legal de retenção (ex. dado financeiro por 5 anos).
7. Disponibilizar ao Cliente as informações necessárias para demonstrar conformidade com este
   Anexo, incluindo a lista de Subprocessadores.

### 5. Subprocessadores autorizados

O Cliente autoriza, desde já, o uso dos Subprocessadores listados em
[`docs/legal/SUBPROCESSADORES.md`](../legal/SUBPROCESSADORES.md) na data de assinatura deste
Anexo. O Pilar garante que cada Subprocessador assume, por contrato, obrigação de proteção de
dado equivalente à deste Anexo.

### 6. Mudança de subprocessador

O Pilar notifica o Cliente com **[PRAZO A DEFINIR — sugestão: 30 dias]** de antecedência antes
de contratar Subprocessador novo, por e-mail ao contato designado pelo Cliente. O Cliente pode
se opor por escrito dentro desse prazo, apresentando razão relacionada a proteção de dado; sem
oposição, o Subprocessador é considerado aprovado.

### 7. Transferência internacional

Quando o Tratamento envolver Subprocessador fora do Brasil (ver
`docs/legal/SUBPROCESSADORES.md`, coluna "Localização"), o Pilar garante mecanismo de
transferência internacional compatível com o Art. 33 da LGPD (cláusula contratual padrão ou
equivalente) com cada um.

### 8. Auditoria

O Cliente pode solicitar, com aviso prévio razoável e no máximo uma vez por ano (salvo
incidente de segurança), evidência de conformidade deste Anexo — relatório de segurança,
certificação de Subprocessador, ou auditoria presencial mediante acordo de confidencialidade
mútuo.

### 9. Vigência

Este Anexo vigora enquanto durar o Contrato principal e sobrevive a ele nas obrigações que, por
natureza, devam perdurar (ex. dever de eliminar/devolver dado, confidencialidade).

---

**Foro:** **[A DEFINIR — depende do CNPJ e endereço da Pilar, ver `docs/legal/README.md`]**.

**Assinatura eletrônica:** este Anexo é incorporado ao aceite do Contrato principal, salvo
exigência específica de assinatura em separado por política interna do Cliente.
