# QA Catálogo 02 — Clientes, Fornecedores e Leads

Ambiente: banco LOCAL (127.0.0.1), app http://localhost:8080, login `admin@pilar.local` / `Pilar@2026` (acesso total). Banco começa vazio: os testes de Clientes/Fornecedores dependem de criar registros antes; os de conversão Lead→Cliente dependem de criar um Lead.

Rotas: `/clientes`, `/clientes/:id`, `/fornecedores`, `/leads`.

Observação de arquitetura relevante para o QA:
- Clientes e Leads usam **soft delete** (`deleted_at`) + toast "Desfazer".
- Fornecedores usa **hard delete** (`.delete()`), sem undo (ver ACH-FOR-01).
- Persistência normaliza documento/telefone para **só dígitos**; máscara é só de exibição.
- Unicidade de Cliente é **por empresa** em `cpf_cnpj`, `email` e `contato` (telefone), apenas entre ativos. Lead tem unicidade de `email` por empresa (case-insensitive).
- Conversão Lead→Cliente roda pela RPC `rpc_converter_lead_cliente`; o enriquecimento por CNPJ (BrasilAPI) é aplicado num **segundo UPDATE em JS** (ver ACH-LEAD-01).

---

## PARTE A — Casos de teste (Camada B, browser)

Formato: **Fluxo** | **Rota/onde** | **Passos** | **Input adversarial** | **Resultado esperado** | **Prioridade**.

### Clientes

**CLI-01 — Criar cliente PF (caminho feliz)** | `/clientes` → "Novo cliente" | Selecionar Pessoa física, preencher Nome "Ana", Sobrenome "Silva", CPF válido (ex.: 111.444.777-35), email `ana@ex.com`, telefone, avançar step 2, Salvar | — | Toast "Cliente cadastrado", dialog fecha, cliente aparece na lista, CPF formatado na coluna | P1

**CLI-02 — Criar cliente PJ (caminho feliz)** | idem | Selecionar Pessoa jurídica, Razão social preenchida, CNPJ válido, Salvar | — | Cliente PJ criado; campo Sobrenome sumiu; sem erro | P1

**CLI-03 — CPF inválido bloqueia** | Form cliente, step 1 | Digitar CPF com 11 dígitos mas dígito verificador errado (ex.: 111.111.111-11 / 123.456.789-00) e clicar Próximo | CPF de sequência repetida, DV incorreto | Erro inline "CPF inválido" / "CPF deve ter 11 dígitos"; não avança | P1

**CLI-04 — CNPJ inválido bloqueia** | Form cliente PJ | CNPJ com DV errado ou <14 dígitos | `00.000.000/0000-00` | Erro "CNPJ inválido"/"CNPJ deve ter 14 dígitos"; não salva | P1

**CLI-05 — Email inválido bloqueia** | Form cliente | Email `ana@`, `ana`, `a@b`, `a b@c.com` | espaços internos, sem TLD | Erro "E-mail inválido"; salvar bloqueado | P1

**CLI-06 — Documento opcional (vazio) permite salvar** | Form cliente | Nome preenchido, CPF/CNPJ vazio, Salvar | — | Salva sem erro (documento é opcional) | P2

**CLI-07 — Telefone rejeita letras** | Form cliente | Digitar "abc12de34" no telefone | letras/símbolos | Máscara descarta não-dígitos; só números formatados aparecem | P2

**CLI-08 — CEP autofill e CEP inválido** | Form cliente, campo CEP | Digitar CEP válido e sair do campo (blur); depois CEP inexistente `00000-000` | CEP com letras, CEP inexistente | CEP válido preenche Endereço; CEP inexistente → toast "CEP não encontrado", endereço intacto. **Verificar:** CEP não é persistido no cliente (só popula Endereço) | P2

**CLI-09 — Nome só com espaços** | Form cliente | Nome = "   ", tentar Próximo/Salvar | espaços | Toast "Preencha o nome/razão social"; não salva | P1

**CLI-10 — Nome com espaços nas bordas** | Form cliente | Nome = "  Ana  ", Salvar | — | Salva; **verificar se persiste com espaços** (ver ACH-CLI-01) | P3

**CLI-11 — Texto gigante (>1000 chars)** | Form cliente, Nome/Endereço/Origem | Colar 5000 chars | overflow | Não deve travar a UI; verificar se DB aceita/trunca e se a lista renderiza sem quebrar layout | P2

**CLI-12 — XSS em campos texto** | Form cliente | Nome/Endereço/Origem = `<script>alert(1)</script>` e `<img src=x onerror=alert(1)>` | XSS | Renderizado como texto literal (React escapa); nenhum alert dispara; sem `dangerouslySetInnerHTML` | P1

**CLI-13 — CPF/CNPJ duplicado (mesma empresa)** | Form cliente | Criar cliente com CPF X; criar 2º cliente com o mesmo CPF X | mesmo documento duas vezes | Toast "CPF/CNPJ já cadastrado"; 2º não é criado | P1

**CLI-14 — Email duplicado** | Form cliente | Dois clientes com mesmo email | — | Toast "E-mail já cadastrado" | P2

**CLI-15 — Telefone duplicado** | Form cliente | Dois clientes com mesmo telefone | mesmo contato | Toast "Contato já cadastrado". **Nota:** unicidade de telefone pode ser restritiva demais (ver ACH-CLI-03) | P2

**CLI-16 — Editar cliente** | Lista → ícone lápis ou row → detalhe → Editar | Alterar dados, Atualizar | — | Toast "Cliente atualizado"; mudança reflete na lista e no detalhe | P1

**CLI-17 — Excluir cliente + Desfazer** | Lista → lixeira → confirmar | Excluir, depois clicar "Desfazer" no toast | — | Confirmação exigida; cliente some; "Desfazer" restaura | P1

**CLI-18 — Excluir cliente com projeto vinculado (integridade)** | Criar projeto para o cliente, depois excluir cliente | — | — | Soft delete: cliente some da lista, projeto/receitas/propostas históricos preservados (não orfanados). Confirmar no detalhe do projeto que histórico segue íntegro | P1

**CLI-19 — Filtros combinados + busca estranha** | `/clientes`, filtros Tipo/Origem/Projeto/Portal + busca | Aplicar filtros; buscar `%_\`, emoji, `' OR 1=1`, string 500 chars | curingas SQL, injeção, unicode | Busca tratada como literal (ESCAPE no RPC), sem erro/500; empty state "Nenhum resultado" com "Limpar filtros" | P1

**CLI-20 — Busca por CNPJ formatado vs dígitos** | Busca | Buscar "11.444" e "11444" | — | Ambos encontram (RPC compara dígitos e nome/email) | P2

**CLI-21 — Ordenação por colunas** | Cabeçalho Nome / CPF-CNPJ | Clicar para alternar asc/desc | — | Ícone muda; ordem correta; volta pra página 1 | P2

**CLI-22 — Paginação: excluir último item da última página** | Lista com >20 clientes | Ir à última página, excluir o único item dela | — | Página corrige-se (clampPage) sem tela vazia travada | P2

**CLI-23 — Contas bancárias: adicionar/remover/principal** | Form cliente step 2 | Adicionar conta sem banco/agência/conta; adicionar 2 contas; marcar principal; remover a principal | campos incompletos | Toast "Dados incompletos" se faltar campo; 1ª conta vira principal; ao remover principal, próxima assume | P2

**CLI-24 — Chave PIX inválida e duplicada** | Form cliente step 2 | Adicionar PIX "xyz"; adicionar mesma chave 2x | formato inválido, duplicado | "Chave inválida" para formato irreconhecível; "Chave duplicada" na repetição | P2

**CLI-25 — Portal: criar acesso / redefinir / revogar** | `/clientes/:id` → Visão Geral (admin) | Criar acesso (cliente com email), redefinir senha, revogar | cliente sem email | Sem email → texto "Cadastre um email"; com email → cria e mostra credenciais; revogar remove acesso. (MFA bypassado no local) | P1

**CLI-26 — Enviar mensagem (feliz + guarda de vazio)** | Lista ícone Mail / detalhe | Enviar com assunto+mensagem; tentar com campos vazios | vazio | Botão Enviar desabilitado sem assunto/mensagem; envio OK → toast sucesso | P2

**CLI-27 — Mensagem: falha de rede** | Lista ícone Mail | Desligar rede / forçar erro na edge function e enviar | rede offline | **Verificar feedback:** em `/clientes` a falha inesperada pode ficar silenciosa (ver ACH-CLI-04); no detalhe mostra toast de erro | P2

**CLI-28 — Duplo submit** | Form cliente | Clicar Salvar 2x rápido | double click | Botão desabilita com "Salvando..."; não cria duplicado | P2

**CLI-29 — Deep-link ?edit=<id>** | `/clientes?edit=<uuid>` | Abrir URL com id de cliente fora da página atual | id inexistente | Abre o form de edição do cliente; id inexistente não abre nada nem quebra | P3

**CLI-30 — Enviar msg para cliente sem email** | Lista | Cliente sem email: botão Mail | — | Botão desabilitado com título "Cliente sem e-mail cadastrado" | P3

### Fornecedores

**FOR-01 — Criar fornecedor (feliz)** | `/fornecedores` → "Novo Fornecedor" | Nome, CNPJ válido, contato, telefone, email, Salvar | — | Toast "Fornecedor adicionado"; aparece na lista | P1

**FOR-02 — Nome obrigatório / só espaços** | Form fornecedor | Nome vazio ou "   " | espaços | Toast "O nome do fornecedor é obrigatório"; não salva | P1

**FOR-03 — CNPJ inválido / válido** | Form fornecedor | CNPJ com DV errado; depois válido | `11.111.111/1111-11` | "CNPJ inválido" bloqueia; CNPJ vazio permitido (opcional); válido salva | P1

**FOR-04 — Email inválido** | Form fornecedor | `x@`, `x` | — | "E-mail inválido"; não salva | P2

**FOR-05 — CNPJ duplicado** | Form fornecedor | Criar 2 fornecedores com mesmo CNPJ | mesmo CNPJ | Toast "CNPJ já cadastrado para outro fornecedor" | P1

**FOR-06 — Editar fornecedor** | Lista → lápis | Alterar e Atualizar | — | Toast "Fornecedor atualizado" | P2

**FOR-07 — Excluir fornecedor (SEM undo)** | Lista → lixeira → confirmar | Excluir | — | Confirmação exigida; fornecedor some; **não há "Desfazer"** (diferente de Clientes/Leads) | P2

**FOR-08 — Excluir fornecedor vinculado a despesa (integridade)** | Vincular fornecedor a uma despesa no Financeiro, depois excluir o fornecedor | — | — | **Verificar:** hard delete + FK ON DELETE SET NULL → a despesa perde a referência ao fornecedor silenciosamente, sem aviso (ver ACH-FOR-01) | P1

**FOR-09 — Busca com termo estranho** | Campo busca | `%_`, emoji, 500 chars, injeção | curingas | Filtro em memória, sem erro; empty state "Nenhum resultado" com "Limpar busca". Nota: busca também casa email apesar do placeholder (ACH-FOR-03) | P2

**FOR-10 — Texto gigante / XSS** | Form fornecedor | Nome/contato/email = `<script>`/`<img onerror>` e 5000 chars | XSS/overflow | Texto escapado (sem execução); layout não quebra | P2

**FOR-11 — Estado de erro na carga** | `/fornecedores` | Forçar falha na query (offline / RLS) ao carregar | rede offline | **Verificar:** hoje só há toast; a tela mostra "Nenhum fornecedor cadastrado" (erro mascarado como vazio, sem skeleton) — ver ACH-FOR-02 | P1

**FOR-12 — Duplo submit** | Form fornecedor | Salvar 2x / Enter repetido | — | Botão "Salvando..." desabilita; sem duplicado | P2

### Leads

**LEAD-01 — Criar lead (feliz)** | `/leads` → "Novo Lead" | Nome, email, telefone, origem, valor estimado, previsão, responsável, Salvar | — | Toast "Lead cadastrado"; card aparece na coluna Novo | P1

**LEAD-02 — Nome obrigatório** | Form lead | Nome vazio, submeter | espaços | Erro inline "Informe o nome do lead"; não salva | P1

**LEAD-03 — Email inválido e duplicado** | Form lead | Email malformado; depois email já usado por outro lead | duplicado, malformado | "E-mail inválido" bloqueia; duplicado → toast "Email duplicado" (checagem JS + índice único no DB) | P1

**LEAD-04 — CNPJ inválido / válido no lead** | Form lead | CNPJ com DV errado (blur e submit); depois válido | — | "CNPJ inválido" no blur e no submit; CNPJ vazio permitido | P2

**LEAD-05 — Origem "Outro" libera campo livre** | Form lead | Selecionar Outro e digitar origem custom | vazio no custom | Campo texto aparece; valor custom vira a origem | P3

**LEAD-06 — Arrastar entre colunas (feliz)** | Kanban desktop | Arrastar card Novo → Em contato | — | Update otimista; toast "Status atualizado"; se falhar, rollback visual | P1

**LEAD-07 — Mover para Perdido exige motivo** | Kanban | Arrastar → Perdido; confirmar sem motivo; depois com motivo | motivo vazio | Dialog abre; "Confirmar" desabilitado sem texto; salva motivo_perda; cancelar não muda status | P1

**LEAD-08 — Mover para Ganho abre conversão (com CNPJ)** | Kanban | Arrastar lead sem cliente → Ganho; no dialog buscar CNPJ válido e "Criar Cliente" | CNPJ inexistente/ inválido | Lookup BrasilAPI preenche razão social/endereço; cria cliente com esses dados; CNPJ inválido → botão busca desabilitado / "CNPJ não encontrado" | P1

**LEAD-09 — Conversão preserva CNPJ e razão social** | Conversão | Converter lead que tem `cnpj` e `empresa_lead` | — | Cliente nasce com `cpf_cnpj` = dígitos do CNPJ e nome = razão social (empresa_lead ou lookup); **verificar que CNPJ NÃO é descartado** | P1

**LEAD-10 — Conversão "Criar sem CNPJ" e "Apenas marcar como Ganho"** | Dialog de conversão | Testar as 3 saídas: com CNPJ, sem CNPJ, só marcar Ganho | — | "Sem CNPJ" cria cliente com dados do lead; "Apenas marcar" muda status sem criar cliente | P2

**LEAD-11 — Converter a partir do detalhe** | Card → detalhe → "Transformar em Cliente" | Lead Ganho sem cliente_id | — | Abre o mesmo dialog de CNPJ; converte | P2

**LEAD-12 — Converter lead já convertido (guarda)** | Detalhe de lead com cliente_id | Tentar converter de novo | — | Toast "Já convertido / Lead já foi convertido"; sem duplicar cliente | P1

**LEAD-13 — Falha no enriquecimento pós-conversão** | Conversão com CNPJ que já existe em outro cliente ativo | Converter com CNPJ duplicado | CNPJ colidente | **Verificar estado:** lead pode terminar convertido (Ganho + cliente_id) mesmo com toast "Erro na conversão", e o enriquecimento não aplicado (ver ACH-LEAD-01) | P1

**LEAD-14 — Editar lead** | Detalhe → menu → Editar dados | Alterar e salvar; tentar email de outro lead | duplicado | Toast "Lead atualizado"; email duplicado bloqueado | P2

**LEAD-15 — Excluir lead + Desfazer** | Detalhe → menu → Excluir → confirmar | Excluir e clicar Desfazer | — | Confirmação; card some; "Desfazer" restaura | P1

**LEAD-16 — Filtros: origem, responsável, período, estágio, ordenação** | Barra de filtros | Combinar filtros; "Sem responsável"; período "Previsão vencida"; ordenar por valor/previsão | — | Contagem por coluna e cards refletem filtros; leads sem previsão vão pro fim na ordenação por data; "Limpar" reseta tudo | P2

**LEAD-17 — Busca no kanban** | Campo busca | Buscar por nome/empresa/email; termos estranhos, emoji, 500 chars | — | Filtra sem erro; empty state "Nenhum resultado para esses filtros" | P2

**LEAD-18 — Criar proposta a partir do lead** | Detalhe → "Criar Proposta" | Confirmar | lead Perdido/Ganho | Cria proposta, muda lead p/ Proposta, redireciona ao editor. Botão desabilitado se lead Perdido ou Ganho | P2

**LEAD-19 — Texto gigante / XSS em nome e notas** | Form lead | Notas com 5000 chars; nome/notas com `<script>`/`<img onerror>` | overflow/XSS | Sem execução de script; textarea/preserva quebras; layout não quebra (ver ACH-LEAD-02) | P2

**LEAD-20 — Valor estimado e previsão** | Form lead | Valor com máscara R$; previsão no passado | data passada | Máscara de moeda aplicada; previsão passada aceita (sem validação de futuro) — confirmar comportamento | P3

**LEAD-21 — Duplo submit / dupla conversão** | Form / dialog conversão | Salvar ou "Criar Cliente" 2x rápido | double click | Botões desabilitam com pending; sem lead/cliente duplicado | P2

---

## PARTE B — Achados estáticos (código)

### 🟠 ACH-FOR-01 — Exclusão de fornecedor é hard delete e orfana despesas sem aviso
**Categoria:** integridade | **Arquivo:** `src/pages/fornecedores/index.tsx:197-205` (+ `199` `.delete()`)
**Cenário:** Um fornecedor vinculado a uma ou mais `despesas` é excluído. O delete é físico (`supabase.from("fornecedores").delete()`), e a FK `despesas_fornecedor_id_fkey` é `ON DELETE SET NULL` (`supabase/migrations/000_base_schema.sql:4381`). A despesa perde a referência ao fornecedor silenciosamente; não há confirmação diferenciada, nem "Desfazer", nem soft delete, embora a tabela `fornecedores` tenha coluna `deleted_at` e a RLS filtre por ela (`000_base_schema.sql:2806`, `5045/5049`).
**Evidência:** Clientes e Leads usam soft delete + undo (`useClientes.ts:271-293`, `useLeads.ts:314-344`); Fornecedores diverge do padrão e o `deleted_at` fica sem uso nesta tela. `ConfirmDialog` diz "Esta ação não pode ser desfeita" (`fornecedores/index.tsx:440`) — verdade, mas o custo é perda de vínculo financeiro histórico.

### 🟠 ACH-FOR-02 — Fornecedores não tem estado de carregamento nem de erro (erro mascarado como "vazio")
**Categoria:** silent-failure / estado | **Arquivo:** `src/pages/fornecedores/index.tsx:67-82` e `365-388`
**Cenário:** Se a query de carga falha (offline, RLS, timeout), `fetchFornecedores` só dispara `toast.error` e deixa `fornecedores` como `[]`. A tabela então renderiza o empty state "Nenhum fornecedor cadastrado", indistinguível de uma base realmente vazia. Não há `isLoading`/skeleton nem `isError`/retry (ao contrário de Clientes `index.tsx:389-423` e Leads `index.tsx:592-618`).
**Evidência:** `if (error) { toast.error("Erro ao carregar fornecedores"); return; }` (linha 69) — a lista permanece vazia; render em `365` usa `fornecedores.length === 0` para decidir o empty state sem considerar erro. Mesmo padrão de "falha que vira estado vazio" já registrado no Dashboard.

### 🟠 ACH-LEAD-01 — Conversão com enriquecimento de CNPJ não é atômica: estado parcial em caso de falha
**Categoria:** corretude / silent-failure | **Arquivo:** `src/hooks/useLeads.ts:251-287` (mutationFn `255-273`)
**Cenário:** `useConvertLeadToClient` faz duas operações independentes: (1) `rpc_converter_lead_cliente` cria o cliente e marca o lead como Ganho/`convertido_em`/`cliente_id` (commit próprio da função); (2) em seguida um `supabase.from("clientes").update(enrichment)` separado aplica razão social/endereço/CNPJ da BrasilAPI. Se o passo (2) falhar (ex.: o CNPJ enriquecido colide com outro cliente ativo → `23505` no índice `clientes_empresa_cpf_cnpj_uidx`), o `throw` cai no `onError` com toast "Erro na conversão", **mas o lead já está convertido e o cliente já existe** (sem o enriquecimento). Retentar → RPC lança "Lead já foi convertido". Usuário vê erro, porém a conversão aconteceu pela metade.
**Evidência:** RPC em `supabase/migrations/20260715000031_leads_convert_enrich_cnpj_razao_social.sql:55-71` insere cliente + update do lead numa transação; o update de enriquecimento é um statement separado no client (`useLeads.ts:265-269`), fora daquela transação.

### 🟡 ACH-LEAD-02 — Conversão pode transformar pessoa em empresa e não define tipo_pessoa
**Categoria:** corretude | **Arquivo:** `src/hooks/useLeads.ts:237-249` (`buildClienteEnrichmentUpdate`)
**Cenário:** Ao converter um lead de pessoa (sem `empresa_lead`) informando um CNPJ no dialog, o enriquecimento sobrescreve `nome` com `razao_social` e grava `cpf_cnpj` = CNPJ, convertendo silenciosamente uma pessoa física em jurídica. Além disso, nem a RPC nem o enriquecimento setam `clientes.tipo_pessoa`; o cliente nasce com `tipo_pessoa NULL` e o tipo passa a ser inferido por contagem de dígitos no form/RPC de listagem.
**Evidência:** `if (enrichment.razao_social) updates.nome = enrichment.razao_social;` (linha 246); RPC não escreve `tipo_pessoa` (`20260715000031_*.sql:55`); inferência em `ClienteFormDialog.tsx:96-101` e `listar_clientes_paginado` (`...080_*.sql:113-118`).

### 🟡 ACH-CLI-01 — Nome/sobrenome do cliente são persistidos sem trim
**Categoria:** validação | **Arquivo:** `src/hooks/useClientes.ts:197-198`
**Cenário:** As checagens de obrigatório usam `nome.trim()` (`ClienteFormDialog.tsx:182,248`), mas o payload envia `nome: data.nome` e `sobrenome: data.sobrenome || null` sem `trim()`. "  Ana  " é salvo com espaços; "   " é barrado, porém " a " passa e persiste com bordas. Afeta ordenação e busca (a RPC normaliza acento mas não apara espaços).
**Evidência:** `nome: data.nome,` (197). Comparar com Fornecedores, que apara: `nome: form.nome.trim()` (`fornecedores/index.tsx:155,167`).

### 🟡 ACH-CLI-02 — Telefone (contato) exibido como dígitos crus na lista e no detalhe
**Categoria:** corretude / consistência | **Arquivo:** `src/pages/clientes/index.tsx:439`; `src/pages/clientes/[id]/index.tsx:300`
**Cenário:** `contato` é armazenado só com dígitos; a lista renderiza `{cliente.contato}` e o detalhe idem, sem `formatPhone`, mostrando "14999999999" enquanto CPF/CNPJ na mesma linha usa `formatDocument`. Fornecedores formata o telefone (`fornecedores/index.tsx:396`), então há inconsistência entre módulos.
**Evidência:** `<TableCell className="hidden lg:table-cell">{cliente.contato}</TableCell>` (439). `formatPhone` está disponível e já importado no form.

### 🟡 ACH-CLI-03 — Unicidade de email e telefone por empresa pode bloquear cadastros legítimos
**Categoria:** integridade / UX | **Arquivo:** `supabase/migrations/20260715000030_clientes_unique_per_empresa.sql:30-36`
**Cenário:** Índices únicos parciais em `(empresa_id, email)` e `(empresa_id, contato)` impedem dois clientes de compartilharem e-mail ou telefone. Cenários reais quebram: cônjuges com o mesmo e-mail, filiais/contatos com o mesmo telefone de central. O erro `23505` vira toast "Contato já cadastrado" / "E-mail já cadastrado", sem caminho alternativo. cpf_cnpj único faz sentido; email/telefone únicos são discutíveis.
**Evidência:** `CREATE UNIQUE INDEX ... clientes_empresa_contato_uidx ON clientes (empresa_id, contato) WHERE deleted_at IS NULL` (34-36); mapeamento do erro em `useClientes.ts:243-246`.

### 🟡 ACH-CLI-04 — Falha inesperada no envio de mensagem fica silenciosa na lista de clientes
**Categoria:** silent-failure | **Arquivo:** `src/pages/clientes/index.tsx:167-191` (catch `188-190`)
**Cenário:** Em `handleSendMessage`, o ramo `error` da edge function reseta o modal e mostra toast; mas o `catch` de exceção inesperada (rede caiu, throw) só chama `monitoring.captureException` sem `toast` e sem fechar o modal. O usuário fica sem feedback. O mesmo fluxo no detalhe (`[id]/index.tsx:510-524`) mostra `toast.error("Erro ao enviar mensagem")` — comportamento divergente entre as duas telas.
**Evidência:** `catch (error) { monitoring.captureException(error, ...); }` (188-190), sem toast.

### 🟡 ACH-LEAD-03 — Campos de texto do lead sem limite de tamanho
**Categoria:** validação | **Arquivo:** `src/pages/leads/components/LeadFormDialog.tsx` (nome `175-184`, empresa `200-205`, notas `309-315`)
**Cenário:** `nome`, `empresa_lead` e `notas` não têm `maxLength`; entrada >1000 chars é enviada direto ao DB (colunas `text`). Não trava, mas polui cards do kanban e não há normalização. `previsao_fechamento` também aceita datas no passado sem aviso.
**Evidência:** Inputs sem `maxLength` (contraste com CNPJ `maxLength={18}` e telefone `maxLength={15}` no mesmo arquivo, `214/247`).

### ⚪ ACH-FOR-03 — Placeholder da busca de fornecedor não bate com o comportamento
**Categoria:** copy/consistência | **Arquivo:** `src/pages/fornecedores/index.tsx:343` vs `217`
**Cenário:** Placeholder diz "Buscar por nome ou CNPJ...", mas o filtro também casa `email` (linha 217). Microcopy desatualizada.

### ⚪ ACH-CLI-05 — Listas de contas/PIX usam índice do array como React key
**Categoria:** estado/a11y | **Arquivo:** `src/pages/clientes/ClienteFormDialog.tsx:599,670`
**Cenário:** `key={index}` em `contasBancarias`/`chavesPix`; ao remover um item do meio, o React pode reaproveitar estado do DOM incorretamente (foco/valores de `<select>` de tipo de chave). Baixo risco por serem itens simples, mas é anti-padrão. Preferir key estável (ex.: `conta`+`agencia` ou id gerado).

---

## Resumo

- **Parte A:** 63 casos (Clientes CLI-01..30 = 30, Fornecedores FOR-01..12 = 12, Leads LEAD-01..21 = 21).
- **Parte B:** 10 achados — 🔴 0 · 🟠 3 · 🟡 6 · ⚪ 2. (Sem críticos: nenhuma brecha de RLS/segurança nova; os riscos são integridade de dados e feedback.)

**Top 3 mais graves:**
1. 🟠 ACH-LEAD-01 — Conversão Lead→Cliente com CNPJ não é atômica: se o enriquecimento falha (ex.: CNPJ duplicado), o lead fica convertido pela metade e o usuário vê "erro" (`useLeads.ts:255-273`).
2. 🟠 ACH-FOR-01 — Excluir fornecedor é hard delete e orfana despesas via FK SET NULL, sem undo nem soft delete, apagando vínculo financeiro histórico (`fornecedores/index.tsx:199`).
3. 🟠 ACH-FOR-02 — Fornecedores sem estado de erro/carga: falha de query vira "Nenhum fornecedor cadastrado", mascarando o erro como base vazia (`fornecedores/index.tsx:67-82,365`).
