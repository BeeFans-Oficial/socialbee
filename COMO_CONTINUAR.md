# 🚀 Como Continuar o Desenvolvimento

## ✅ Setup Inicial Completo

O projeto BeeSocial está **100% funcional** e pronto para os próximos passos!

**Servidor rodando**: http://localhost:3000

---

## 📋 Próximos Prompts (na Ordem)

### PROMPT 2 — Design System & Componentes Base
Implementar componentes UI adicionais do shadcn/ui:
- Dialog/Modal
- Switch/Toggle
- Tabs
- Badge
- Avatar
- Scroll Area
- Separator
- Tooltip
- Toast (Sonner)

### PROMPT 3 — Landing Page Completa
Aprimorar a landing page com:
- Seção de features expandida
- Depoimentos de creators
- Seção de pricing
- FAQ
- Footer completo
- Animações com Framer Motion

### PROMPT 4 — Página Pública de Perfil
Criar página `app/[slug]/page.tsx` com:
- Header do perfil (avatar, nome, bio)
- Lista de links clicáveis
- Cloaking JS para crawlers sociais
- Meta tags dinâmicas (Open Graph)
- Tema customizável por usuário

### PROMPT 5 — Modal de Verificação de Idade
Componente `AgeGate.tsx`:
- Modal fullscreen de verificação +18
- Animação de entrada
- Persistência no localStorage
- Botões de confirmação/negação
- Redirect se menor de idade

### PROMPT 6 — Dashboard Layout & Sidebar
Criar `app/(dashboard)/layout.tsx`:
- Sidebar fixa com navegação
- Header com user dropdown
- Menu mobile responsivo
- Links ativos destacados
- Logo e brand

### PROMPT 7 — Gerenciador de Links
Página `app/(dashboard)/links/page.tsx`:
- Lista de links com drag & drop
- Modal para adicionar/editar links
- Toggle ativo/inativo
- Preview em tempo real
- Badge para links premium

### PROMPT 8 — Aparência & Temas
Página `app/(dashboard)/aparencia/page.tsx`:
- Seletor de temas predefinidos
- Preview ao vivo no PhoneMockup
- Customização de cores
- Upload de avatar e cover
- Fontes e estilos de botão

### PROMPT 9 — Analytics (Mockado)
Página `app/(dashboard)/analytics/page.tsx`:
- Cards de métricas (views, clicks, CTR)
- Gráfico de views (7 dias)
- Top links por cliques
- Dados todos mockados
- Componente de chart simples

### PROMPT 10 — Login e Cadastro
Páginas `app/(auth)/login` e `cadastro`:
- Formulários estilizados
- Validação básica
- Estado de loading
- **SEM backend real** - apenas UI
- Redirect simulado para dashboard

---

## 🎨 Guia de Estilo (Sempre Seguir)

### Cores
Use as variáveis do Tailwind:
```tsx
// Backgrounds
bg-bee-bg          // #0d0d0d
bg-bee-surface     // #151515
bg-bee-surface2    // #1e1e1e

// Pink/Accent
text-bee-pink      // #FF3C6E
bg-bee-pink
border-bee-pink

// Text
text-bee-text      // #FFFFFF
text-bee-muted     // #888888
text-bee-dim       // #555555

// Border
border-bee-border  // rgba(255, 60, 110, 0.15)
```

### Botões
```tsx
// Primário (padrão)
<Button>Criar Conta</Button>

// Outline
<Button variant="outline">Cancelar</Button>

// Ghost (menu)
<Button variant="ghost">Dashboard</Button>

// Link
<Button variant="link">Saiba mais</Button>
```

### Glow Effects
```tsx
// Glow grande (botões principais)
className="glow-pink"

// Glow pequeno (hover)
className="glow-pink-sm"

// Text glow (títulos)
className="text-glow"
```

### Gradientes
```tsx
// Gradiente de texto
className="gradient-text"

// Gradiente de background (botões)
className="bg-gradient-to-r from-bee-pink to-bee-pink-hot"
```

### Tipografia
```tsx
// Títulos grandes (uppercase)
className="font-bebas text-7xl uppercase"

// Subtítulos
className="font-barlow font-bold text-2xl"

// Corpo/UI (padrão)
className="font-sans text-base"
```

### Hexágonos Decorativos
```tsx
// Sempre usar no background das páginas principais
<HexBackground density="medium" animated />
```

---

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Lint
npm run lint

# Adicionar componente shadcn (se necessário)
npx shadcn@latest add [component-name]
```

---

## 📦 Estrutura de Componentes

### Padrão de Imports
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/shared/Logo";
import { HexBackground } from "@/components/shared/HexBackground";
import { mockUser, mockLinks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
```

### Padrão de Client Components
Se usar hooks ou interatividade:
```tsx
"use client";

import { useState } from "react";
// ... resto do código
```

### Padrão de Server Components
Padrão do Next.js (não precisa marcar):
```tsx
// app/page.tsx
export default function Page() {
  // ... código
}
```

---

## 🎯 Checklist de Qualidade

Antes de finalizar cada componente/página, verificar:

- ✅ Usa a paleta de cores `bee-*`
- ✅ Segue a tipografia (Bebas Neue/Barlow/Inter)
- ✅ Tem HexBackground quando apropriado
- ✅ Usa componentes UI consistentes
- ✅ Responsivo (mobile-first)
- ✅ Animações suaves (Framer Motion quando necessário)
- ✅ Sem erros de TypeScript
- ✅ Sem erros de linting
- ✅ Código limpo e comentado (quando necessário)

---

## 💡 Dicas

1. **Sempre use `cn()` para merge de classes**:
   ```tsx
   className={cn("base-classes", conditionalClass && "extra-class", className)}
   ```

2. **Para links internos, use `next/link`**:
   ```tsx
   import Link from "next/link";
   <Link href="/dashboard">Dashboard</Link>
   ```

3. **Para ícones, use `lucide-react`**:
   ```tsx
   import { Heart, Star, TrendingUp } from "lucide-react";
   <Heart className="w-5 h-5 text-bee-pink" />
   ```

4. **Mock data está em `lib/mock-data.ts`**:
   - Sempre use os dados mockados
   - Não faça fetch real de APIs
   - Simule delays com setTimeout se necessário

5. **HexBackground em todas as páginas principais**:
   - Landing page ✅
   - Login/Cadastro
   - Dashboard
   - Perfil público (opcional)

---

## 🐝 Filosofia BeeSocial

**Visual**: Dark, neon, vibrante — estética premium de creators  
**Tom**: Profissional mas sexy, elegante mas ousado  
**Referência**: Hexágonos neon pink em fundo preto puro  

**Não usar**:
- ❌ Cores claras (fundo branco)
- ❌ Dourado (a cor é PINK)
- ❌ Emojis (exceto no conteúdo dos links)
- ❌ Ícones genéricos (sempre lucide-react)

---

**Boa sorte e divirta-se criando o BeeSocial! 🐝✨**
