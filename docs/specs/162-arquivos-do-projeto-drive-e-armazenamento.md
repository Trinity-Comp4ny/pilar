# SPEC: Arquivos do projeto: pasta do Drive dentro da Pilar e armazenamento próprio

**Data:** 2026-11-10  
**Status:** Draft (análise para decisão do CEO)  
**Autor:** —  
**Módulo:** projetos | portal

## Problema

Os arquivos do projeto (pranchas, DWG, IFC, memoriais, ART) vivem no Google Drive do escritório. Na Pilar só dá
para colar um link solto no projeto. A equipe ainda sai da Pilar para achar o material, e o cliente não vê nada
disso no portal. Na reunião com a VRZ (10/11) o sócio pediu um botão de "conectar o Drive", ver as pastas dentro
da Pilar e, no futuro, o cliente acessar os projetos pelo portal mesmo depois de finalizados.

## O que existe hoje (levantado no código)

- **Links do projeto, da disciplina e da tarefa:** `projetos.links`, `projeto_disciplinas.links` e `tarefas.links`
  (jsonb `[{url, rotulo}]`), editados pelo `LinksEditor`. É só URL colada. O bloco de links do projeto aparece no
  modal do quadro (`ProjectDetailDialog`), não na página `/projetos/:id`.
- **Esses links NÃO vão para o cliente.** Não há opção de compartilhar no `LinksEditor`. Na reunião isso foi
  apresentado como se fosse ao portal; não vai.
- **O que chega ao cliente:** `portal_entregas.drive_url` (só aceita `drive.google.com`/`docs.google.com`),
  cadastrado em Clientes > Entregas. Há bucket privado `portal-entregas` e as edge functions
  `upload-portal-entrega` e `portal-entrega-download`, mas nenhuma tela usa o upload.
- **Nenhuma integração com a API do Google Drive.** Google só aparece no login.
- **Decisão vigente (CEO, 2026-07-30, SPEC 013):** anexo entra por link externo; a Pilar não hospeda binário.
  Esta spec propõe rever isso em partes.

## Quanto custa guardar arquivo (preços de nov/2026)

A premissa "armazenamento é caríssimo" vale para o Supabase acima da franquia e para a saída de dados, não para
guardar em si.

| Opção                        | Guardar                                | Saída (download)                  | 1 escritório tipo VRZ¹                                      |
| ---------------------------- | -------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Supabase Storage (plano Pro) | 100 GB inclusos, depois US$ 0,021/GB   | franquia do plano, depois cobrada | cabe na franquia no 1º ano; disputa com os outros clientes  |
| Cloudflare R2                | US$ 0,015/GB-mês (10 GB grátis)        | **grátis**                        | ~US$ 1,50/mês no 1º ano, ~US$ 7,50/mês com 5 anos de acervo |
| Google Drive do escritório   | o escritório já paga (2 TB ~R$ 50/mês) | grátis para a Pilar               | R$ 0 para a Pilar                                           |

¹ ~1 GB por projeto e ~100 projetos por ano (números da própria reunião).

Leitura: com 20 escritórios do tamanho da VRZ e 5 anos de acervo (10 TB) o R2 custaria ~US$ 150/mês. Cabe no
preço se o armazenamento for limitado por plano (o modelo por uso que já usamos: básico com X GB, Ultra com mais).
O risco real não é o custo por GB, é virar o "Drive" do escritório: backup, versão, sincronização com o desktop,
DWG de 200 MB. Isso o Google faz melhor e o escritório já paga.

## Opções

**A. Pasta do Drive do projeto (sem OAuth).** O projeto ganha um campo "Pasta no Drive". A Pilar mostra a pasta
embutida numa aba do projeto (`drive.google.com/embeddedfolderview?id=<pasta>`), com a sessão do Google de quem
está vendo: quem já tem acesso à pasta navega e abre os arquivos sem sair da Pilar. Chave "Mostrar ao cliente"
leva a mesma pasta ao portal (o escritório compartilha a pasta com o e-mail do cliente no Drive, como já faz).
Custo zero, sem verificação do Google, entrega em poucos dias. Não cria nem organiza pasta. A URL de pasta
embutida não é API documentada do Google (pode mudar) e exige liberar `drive.google.com` no `frame-src` do CSP.

**B. Conectar o Google Drive (OAuth, escopo `drive.file`).** Botão "Conectar Google Drive" em Configurações. Com
`drive.file` (escopo não sensível: verificação leve do Google, sem auditoria de segurança anual) a Pilar:

- cria a estrutura de pastas ao criar o projeto, no padrão que o escritório já usa
  (`Projetos > 2026 > 421 - Cliente > ARQUITETÔNICO / ESTRUTURAL / ELÉTRICO / HIDRÁULICO / ART`), uma subpasta
  por disciplina;
- sobe arquivo direto para a pasta certa a partir da disciplina e da entrega do portal;
- lista e abre o que ela criou ou o que o usuário escolher pelo Google Picker.

Limite do `drive.file`: arquivo que alguém joga direto no Drive, por fora da Pilar, não aparece na listagem pela
API (a aba embutida da opção A continua mostrando tudo). Ler a pasta inteira exige o escopo `drive` completo, que
é restrito: verificação do Google mais auditoria de segurança (CASA) todo ano, com custo e meses de prazo. Não
vale agora. A confirmar num protótipo: se escolher a pasta pelo Picker dá acesso aos arquivos de dentro.

**C. Armazenamento próprio (R2) só para o que vai ao cliente.** Entregas do portal (PDF final, ART, memorial)
ficam guardadas na Pilar, com versão e aceite do cliente, e continuam acessíveis depois do projeto finalizado
(o "QR code com acesso a todos os projetos" que o sócio citou). Volume pequeno (PDF, não DWG), cota por plano.
Reaproveita o bucket `portal-entregas` e as duas edge functions que já existem, trocando o destino para R2 se o
volume crescer.

## Recomendação

Fazer na ordem **A → C → B**:

1. **A agora:** resolve "ver o Drive dentro da Pilar" e "cliente acessa" sem custo e sem OAuth. Junto, corrigir o
   que a reunião expôs: links do projeto na página `/projetos/:id` e chave "Mostrar ao cliente" por link.
2. **C em seguida:** é o que dá valor de venda (portal com as entregas para sempre, prova de entrega e aceite) e
   tem volume controlado. Revê em parte a decisão de 2026-07-30: a Pilar passa a guardar entregas finais, não o
   acervo de trabalho.
3. **B quando houver 3+ escritórios pedindo organizar pasta pela Pilar:** é o maior esforço (OAuth do Google, token
   por empresa, tela de conexão, verificação do app) e o ganho sobre A é criar e organizar pastas.

**Fora de escopo:** sincronizar o Drive inteiro, OneDrive/Dropbox (mesma ideia da opção A serve para OneDrive
com o link de incorporação deles), visualizador de DWG/IFC (fica para o leitor de projetos).

## Critérios de aceite (opção A)

- [ ] Admin ou coordenador cola o link de uma pasta do Drive no projeto; a Pilar aceita só link de pasta do
      Google Drive e guarda o id da pasta.
- [ ] A aba "Arquivos" do projeto mostra a pasta embutida; sem pasta, mostra como vincular.
- [ ] Quem não tem acesso à pasta no Google vê o aviso do Google e um botão "Abrir no Drive", sem erro da Pilar.
- [ ] Com "Mostrar ao cliente" ligado, o projeto no portal mostra a mesma pasta; desligado, não aparece.
- [ ] Links do projeto aparecem também na página `/projetos/:id`.

## Decisões em aberto (CEO)

- Aprovar a ordem A → C → B.
- Rever a decisão de 2026-07-30 para a opção C (entregas finais guardadas na Pilar, com cota por plano).
