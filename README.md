# 🐝 BeeSocial

Plataforma de Link Tree para Criadores de Conteúdo Adulto

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Framer Motion**
- **Lucide React** (ícones)

## Identidade Visual

### Paleta de Cores
- **Background Principal**: `#0d0d0d` (preto puro)
- **Surface**: `#151515` (cards/painéis)
- **Pink Primário**: `#FF3C6E` (cor de marca)
- **Pink Vibrante**: `#FF1F57` (hover states)
- **Border Sutil**: `rgba(255, 60, 110, 0.15)`

### Elementos Visuais
- **Hexágonos** com borda neon pink decorando o background
- **Glow effects** em botões e elementos principais
- **Gradientes** de pink para pink-hot

### Tipografia
- **Display/Títulos**: Bebas Neue (bold, uppercase)
- **Subtítulos**: Barlow (600, 700)
- **Corpo/UI**: Inter (400, 500, 600)

## Como Rodar

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar produção
npm start
```

Acesse [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
beesocial/
├── app/
│   ├── (auth)/           # Rotas de autenticação
│   ├── (dashboard)/      # Rotas do dashboard
│   ├── [slug]/           # Páginas públicas de perfil
│   ├── demo/             # Página de demonstração
│   └── page.tsx          # Landing page
├── components/
│   ├── ui/               # Componentes base shadcn
│   ├── dashboard/        # Componentes do dashboard
│   ├── profile/          # Componentes de perfil público
│   └── shared/           # Componentes compartilhados
└── lib/
    ├── mock-data.ts      # Dados mockados
    ├── cloak.ts          # Funções de cloaking
    └── utils.ts          # Utilitários
```

## Funcionalidades (Frontend Mock)

- ✅ Landing page com identidade visual completa
- 🚧 Sistema de autenticação (login/cadastro)
- 🚧 Dashboard para gerenciar links
- 🚧 Páginas públicas de perfil customizáveis
- 🚧 Analytics de cliques e visualizações
- 🚧 Temas e personalização
- 🚧 Modal de verificação de idade (+18)
- 🚧 Cloaking para crawlers sociais

## Notas Importantes

⚠️ **Apenas Frontend** — Todos os dados são mockados. Não há backend real.

🎨 **Design System** — Todos os componentes seguem a identidade visual BeeSocial com hexágonos neon pink em fundo preto.

## Próximos Passos

Ver o arquivo de prompts principal para continuar implementando:
1. Componentes de UI restantes
2. Páginas de autenticação
3. Dashboard completo
4. Perfil público com cloaking
5. Sistema de analytics mockado
