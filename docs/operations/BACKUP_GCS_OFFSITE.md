# Cópia externa dos backups cifrados — Google Cloud Storage

## Objetivo e estado

O backup noturno da Pilar já gera dois artefatos cifrados em GitHub Actions por
ambiente: um dump completo do PostgreSQL e um arquivo do Supabase Storage.
Esses artifacts expiram após 30 dias. O job `gcs-secondary-copy` em
`.github/workflows/backup-nightly.yml` envia uma **segunda cópia dos arquivos
já cifrados de PRODUÇÃO** a um bucket separado no Google Cloud.

**Estado inicial: desativado.** A cópia só roda a partir de `main` e se a
GitHub Actions Variable `BACKUP_GCS_BUCKET` estiver configurada. Não altera
o backup atual nem os projetos Supabase. Se a segunda cópia falhar, o workflow
fica vermelho e a action de notificações abre uma issue, mas os artifacts
cifrados já criados continuam disponíveis no GitHub.

O job usa OIDC + Workload Identity Federation, sem chave JSON de service account
no repositório. O ambiente GitHub é `production-automation`, o mesmo do backup
noturno, sem aprovação humana que bloquearia a execução agendada.

## Configuração necessária (uma vez)

1. Escolher projeto Google Cloud responsável pela continuidade do negócio.
   Criar um **bucket privado, dedicado a backup**, preferencialmente em São
   Paulo (`southamerica-east1`), com Uniform bucket-level access e sem
   permissão pública. Avaliar custo de armazenamento, requests e retenção.
2. Configurar política de retenção conforme avaliação jurídica (por exemplo,
   90 dias), versionamento ou soft delete adequados, monitoramento e proteção
   contra exclusões indevidas. Uma conta de serviço limitada a esse bucket
   deve poder **criar objetos e ler metadados** para confirmar tamanhos
   (permissões `storage.objects.create` e `storage.objects.get`). Evitar
   `storage.admin`, `storage.objects.delete` ou `storage.objects.update`.
   Criar papel personalizado se necessário, em vez de conceder Owner/Editor.
3. Criar Workload Identity Pool e provider OIDC com emissor
   `https://token.actions.githubusercontent.com`. Restringir no provider
   **repository, branch e environment**. Exemplo de condição CEL:
   `assertion.repository == 'Trinity-Comp4ny/pilar' && assertion.ref == 'refs/heads/main' && assertion.environment == 'production-automation'`.
   Se o mapeamento incluir atributos customizados, valide as claims contra o
   token GitHub antes de conceder acesso. Vincular a identidade federada
   somente à conta de serviço dedicada, com
   `roles/iam.workloadIdentityUser`.
4. Em GitHub → Settings → Secrets and variables → Actions → **Variables do
   repositório** (o workflow lê `vars` no nível do job), definir:
   - `BACKUP_GCS_BUCKET`: somente nome do bucket, sem `gs://`
   - `BACKUP_GCS_PROJECT_ID`: ID do projeto Google Cloud
   - `BACKUP_GCS_WIF_PROVIDER`: recurso completo do provider
     (`projects/NUMERO/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`)
   - `BACKUP_GCS_SERVICE_ACCOUNT`: e-mail da service account dedicada

   **Não** colocar chaves JSON, dump ou senhas nas variables. A chave
   `BACKUP_ENCRYPTION_KEY` já existente continua restrita ao job `backup`;
   ela **não** é passada ao job de cópia externa.
5. Validar o GitHub Environment `production-automation`: a credencial OIDC
   só deve ser utilizável nas condições configuradas. Proteger `main`
   com reviews e checks. Revisar `.gitignore` para não versionar arquivos
   `gha-creds-*.json` caso alguém execute essas ações localmente.

## Como funciona

- `backup` termina as pernas Staging e Production com sucesso.
- `gcs-secondary-copy`, quando habilitado, baixa **somente** os artifacts
  `backup-Production-RUN_ID` e `storage-Production-RUN_ID` daquele run,
  verifica que ambos não estão vazios e grava `SHA256SUMS.txt` sobre os dois
  arquivos cifrados.
- Os três objetos vão para
  `gs://BUCKET/pilar/production/RUN_ID-RUN_ATTEMPT/{backup-Production.tar.gz.enc,storage-Production.tar.gz.enc,SHA256SUMS.txt}`.
  O job compara tamanhos locais e remotos. A transferência é feita por
  `gcloud storage`, não por `gsutil`.
- Nenhum SQL, foto, áudio ou documento é descriptografado durante a cópia.

## Validação operacional obrigatória

1. Após a configuração, disparar **manualmente o workflow na branch `main`**
   e confirmar que `backup` e `gcs-secondary-copy` estão verdes.
2. No bucket, conferir os três objetos no mesmo `RUN_ID-RUN_ATTEMPT`, tamanhos e hash dos
   dois arquivos cifrados usando o `SHA256SUMS.txt`. Verificar que o acesso
   público está desabilitado, que há retenção e que ninguém consegue apagar
   arquivos durante o período protegido.
3. Fazer **restauração de ensaio isolada**, usando uma cópia baixada do GCS.
   A chave de cifragem só deve ser usada no runner/ambiente de ensaio
   autorizado; nunca imprimir ou guardar a chave junto aos arquivos.
   Reutilizar `scripts/backup-restore-test.sh` para o banco e
   `scripts/storage-backup.mjs verify` para o Storage. O ensaio completo de
   banco + objetos em um projeto descartável é uma melhoria subsequente.
4. Configurar monitoramento para ausências do backup no GCS (> 26 horas),
   mesmo que GitHub Actions esteja indisponível. Revisar despesas do bucket
   e recuperação trimestralmente.

## Limites e decisões deliberadas

- A cópia externa **não reduz o RPO de 24 horas** nem implementa PITR.
- O drill mensal atual ainda utiliza o artifact do GitHub, não o GCS;
  acrescentar um teste de recuperação da cópia independente é a próxima etapa.
- A criptografia atual é AES-256-CBC com PBKDF2 e oferece confidencialidade,
  mas não autenticação criptográfica do arquivo cifrado. O manifesto SHA-256
  detecta corrupção acidental, não substitui assinatura autenticada contra um
  atacante que possa substituir simultaneamente os dados e o manifesto.
- Os dados estão cifrados antes de sair do GitHub, mas a localização do bucket,
  os subprocessadores e os prazos de retenção exigem atualização no ROPA e na
  documentação jurídica conforme uso real, sem afirmar conformidade automática.
- A política IAM/retention precisa ser configurada no Google Cloud. Esta PR
  **não** cria bucket, service account, provider, bindings nem muda produção.

Documentação oficial: [GitHub OIDC e autenticação Google Cloud](https://github.com/google-github-actions/auth);
[Google Cloud Storage](https://cloud.google.com/storage/docs).
