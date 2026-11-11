# SPEC: Arquivos do projeto no Google Drive conectado à Pilar

**Data:** 2026-11-10  
**Status:** Em implementação (opção B aprovada pelo CEO em 2026-11-10)  
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

## Decisão (CEO, 2026-11-10)

- **Opção B aprovada:** conectar o Google Drive de verdade, não só colar link. A ideia é ficar fácil de mexer
  sem sair da Pilar.
- **Opção A descartada como entrega própria:** colar o link do Drive no projeto já existe.
- **Opção C fora:** a Pilar não guarda arquivo por enquanto. Segue valendo a decisão de 2026-07-30.

## Como ficou (opção B)

**Conexão por escritório.** Em Configurações > Integrações, o admin conecta UMA conta Google (a do escritório).
A Pilar pede o escopo `drive.file` e cria no Drive dessa conta a pasta `Pilar - <Escritório>`. O refresh token
fica cifrado (AES-GCM) em `google_drive_conexoes`; só a Edge Function lê. Desconectar revoga o token no Google e
apaga as ligações de pasta; os arquivos ficam no Drive.

**Pasta por projeto.** A aba **Arquivos** do projeto chama `google-drive` (`pasta_projeto`): quem edita o projeto
ganha, na primeira vez, a pasta com o nome do projeto e uma subpasta por disciplina (as que faltarem, sempre que
abrir). As ligações ficam em `drive_pastas`, que também é a lista do que a função aceita listar e mexer
(tenancy: pasta fora da lista ou de outra empresa é recusada; arquivo só se o pai estiver na lista).

**Na aba Arquivos:** navegar pelas pastas (caminho clicável), enviar arquivos (botão ou arrastar; o binário vai do
navegador direto para o Google por upload retomável, sem passar pela Pilar, até 5 GB por arquivo), criar pasta,
baixar (passa pela função: quem vê pela Pilar não precisa ter acesso à conta Google), abrir no Drive e mandar
para a lixeira (restaurável no Drive por 30 dias). A pasta de disciplina não vai para a lixeira. Quem só vê o
projeto navega e baixa; criar, enviar e excluir pedem edição em Projetos.

**Limite conhecido do `drive.file`:** arquivo salvo direto no Drive, fora da Pilar, não aparece na lista (a tela
avisa e oferece "Abrir no Drive"). Ver tudo exige o escopo `drive` completo, que é restrito: verificação do Google
e auditoria de segurança (CASA) todo ano. Rever quando houver demanda de clientes.

**Para ligar em cada ambiente** (Google Cloud Console, projeto da Pilar):

1. Ativar a Google Drive API.
2. Tela de consentimento OAuth: app externo, escopos `openid`, `email` e `.../auth/drive.file`, domínio
   `pilarsoft.com.br`, publicar o app (escopo não sensível: verificação de marca, sem CASA).
3. Credencial OAuth "Aplicativo da Web" com o URI de redirecionamento
   `https://<projeto>.supabase.co/functions/v1/google-drive-oauth` (ou o domínio próprio da API, se usado; aí
   também `GOOGLE_DRIVE_REDIRECT_URI`).
4. Secrets das Edge Functions: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` e `GOOGLE_DRIVE_TOKEN_KEY`
   (32 bytes aleatórios em base64: `openssl rand -base64 32`). Sem eles, as funções respondem 503 e a tela
   mostra que a integração não está configurada.
5. CSP do app libera `https://www.googleapis.com` em `connect-src` (o envio sai do navegador).

**Fora desta entrega:** mostrar a pasta no portal do cliente, renomear, mover entre pastas, OneDrive.

## Critérios de aceite (opção B)

- [x] Só admin conecta e desconecta; o retorno do Google volta para a tela de onde saiu, com aviso.
- [x] O state do OAuth é de uso único, expira em 10 minutos e só o hash fica no banco.
- [x] O refresh token fica cifrado; nenhuma tela ou papel `authenticated` lê `google_drive_conexoes`.
- [x] Abrir a aba Arquivos cria a pasta do projeto e as das disciplinas (quem edita); quem só vê não cria.
- [x] Listar, criar pasta, enviar, baixar e excluir só em pasta ligada à empresa de quem chama.
- [x] Conexão revogada no Google vira "conecte de novo", não erro genérico.
- [x] Envio direto ao Google com progresso; nada do arquivo passa pela Pilar.
