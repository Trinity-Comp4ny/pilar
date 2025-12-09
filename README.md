# Pilar - Sistema de Gestão Trinity

Sistema de gestão empresarial desenvolvido com React, TypeScript, Vite e Supabase.

## 🚀 Começando

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase

### Configuração Inicial

1. **Clone o repositório**
```bash
git clone <YOUR_GIT_URL>
cd pilar
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

> ⚠️ **IMPORTANTE**: O arquivo `.env` contém informações sensíveis e **NÃO deve ser commitado** no Git. Ele já está incluído no `.gitignore`.

4. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

## 📁 Estrutura do Projeto

```
pilar/
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   ├── ui/           # Componentes de UI (shadcn/ui)
│   │   ├── Header.tsx
│   │   ├── Layout.tsx
│   │   └── ...
│   ├── pages/            # Páginas da aplicação
│   │   ├── financeiro/   # Módulo financeiro
│   │   │   ├── components/  # Componentes específicos do financeiro
│   │   │   └── tabs/        # Abas do módulo financeiro
│   │   ├── leads/
│   │   ├── pessoas/
│   │   └── ...
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # Integrações externas
│   │   └── supabase/     # Cliente e tipos do Supabase
│   ├── lib/              # Utilitários e helpers
│   └── main.tsx          # Ponto de entrada da aplicação
├── .env                  # Variáveis de ambiente (NÃO commitar)
├── .env.example          # Template de variáveis de ambiente
└── .gitignore           # Arquivos ignorados pelo Git
```

## 🔒 Segurança e Boas Práticas

### Variáveis de Ambiente

1. **Nunca commite o arquivo `.env`**
   - O `.env` já está no `.gitignore`
   - Use `.env.example` como template

2. **Remover `.env` do histórico do Git** (se já foi commitado):
```bash
# Remove do índice do Git mas mantém o arquivo local
git rm --cached .env

# Commit a remoção
git commit -m "Remove .env from repository"

# Push para o repositório remoto
git push
```

3. **Rotação de credenciais**
   - Se suas credenciais foram expostas, gere novas no Supabase
   - Atualize o arquivo `.env` local
   - Notifique a equipe sobre as novas credenciais

### Organização de Código

1. **Componentes**
   - Componentes globais em `src/components/`
   - Componentes específicos de módulo em `src/pages/[modulo]/components/`
   - Componentes UI (shadcn) em `src/components/ui/`

2. **Importações**
   - Use paths absolutos para componentes globais: `@/components/...`
   - Use paths relativos para componentes do mesmo módulo: `../components/...`

3. **Tipos TypeScript**
   - Defina interfaces para props de componentes
   - Use tipos gerados pelo Supabase em `src/integrations/supabase/types.ts`

## 🗄️ Banco de Dados

O projeto usa Supabase como backend. As tabelas principais incluem:

- `profiles` - Perfis de usuários
- `projetos` - Gestão de projetos
- `clientes` - Cadastro de clientes
- `leads` - Gestão de leads
- `receitas` - Receitas financeiras
- `despesas` - Despesas financeiras
- `contas` - Contas bancárias
- `cartoes_credito` - Cartões de crédito
- `categorias_financeiras` - Categorias para receitas/despesas
- `fornecedores` - Cadastro de fornecedores

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build de produção
npm run preview

# Lint
npm run lint
```

## 📦 Tecnologias Principais

- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Supabase** - Backend as a Service
- **Tailwind CSS** - Framework CSS
- **shadcn/ui** - Componentes UI
- **React Router** - Roteamento
- **Recharts** - Gráficos e visualizações

## 🤝 Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/nova-feature`
2. Commit suas mudanças: `git commit -m 'Adiciona nova feature'`
3. Push para a branch: `git push origin feature/nova-feature`
4. Abra um Pull Request

## ⚠️ Problemas Comuns

### Erro de autenticação no Supabase

Verifique se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas no arquivo `.env`.

### Tipos TypeScript desatualizados

Se você modificou o schema do Supabase, regenere os tipos:
```bash
npx supabase gen types typescript --project-id <seu-project-id> > src/integrations/supabase/types.ts
```

## 📄 Licença

Este projeto é proprietário da Trinity Company.

---

**Project URL**: https://lovable.dev/projects/22359da8-57eb-4eda-bdc2-452278964fcc
