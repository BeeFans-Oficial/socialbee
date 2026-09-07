# ✅ PROMPT 7 — DASHBOARD: GERENCIADOR DE LINKS — COMPLETAMENTE IMPLEMENTADO!

## 🎯 O que foi criado:

### 📦 **Dependências Instaladas**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install sonner
npx shadcn@latest add switch dialog
```

**Bibliotecas**:
- ✅ `@dnd-kit/*` → Drag and drop
- ✅ `sonner` → Toast notifications
- ✅ `switch` → Toggle switches (shadcn)
- ✅ `dialog` → Modal dialog (shadcn)

---

### 📁 **Arquivos Criados**

```
components/dashboard/
├── LinkCard.tsx       → Card de link individual com DnD
└── LinkModal.tsx      → Modal adicionar/editar link

app/links/
└── page.tsx           → Página principal de gerenciamento

lib/
└── mock-data.ts       → Interface Link atualizada
```

---

## 📋 **Página Principal (`app/links/page.tsx`)**

### **Header da Página**

**Título**:
```typescript
<h1 className="font-bebas text-[32px] uppercase tracking-wide text-white">
  MEUS LINKS
</h1>
```

**Subtítulo**:
```
"Arraste para reordenar • Clique para editar"
```

**Barra de Ação** (`flex justify-between`):

**Esquerda** - Pill do perfil:
```typescript
<button onClick={handleCopyProfile}>
  <span>beesocial.app/bella</span>
  <Copy className="w-4 h-4 text-bee-pink" />
</button>
```
- ✅ Copia URL completa ao clicar
- ✅ Toast: "Link copiado!"
- ✅ Bg: `bee-surface`
- ✅ Border: `bee-border`, hover pink

**Direita** - Botão adicionar:
```typescript
<Button className="bg-bee-pink rounded-full glow-pink-sm">
  <Plus /> ADICIONAR LINK
</Button>
```
- ✅ Font: Barlow Bold uppercase
- ✅ Background gradient pink
- ✅ Glow effect no hover

---

### **Lista de Links com Drag and Drop**

**Tecnologia**: `@dnd-kit`

**Setup**:
```typescript
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={links.map(l => l.id)}
    strategy={verticalListSortingStrategy}
  >
    {/* LinkCards */}
  </SortableContext>
</DndContext>
```

**handleDragEnd**:
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    setLinks(items => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      // Atualizar positions
      return newItems.map((item, index) => ({
        ...item,
        position: index,
      }));
    });
    
    toast.success("Ordem atualizada!");
  }
};
```

---

### **Estado Vazio**

Quando `links.length === 0`:

**Visual**:
- ✅ Ícone de link 48px em círculo cinza
- ✅ Título "Nenhum link ainda" (Bebas Neue 24px)
- ✅ Subtítulo "Adicione seu primeiro link para começar" (muted)
- ✅ Botão "+ Adicionar link" pink

**Layout**:
```typescript
<div className="flex flex-col items-center justify-center py-20">
  <div className="w-16 h-16 rounded-full bg-bee-surface flex items-center justify-center">
    <LinkIcon className="w-8 h-8 text-[#333]" />
  </div>
  {/* ... */}
</div>
```

---

## 🃏 **LinkCard Component (`components/dashboard/LinkCard.tsx`)**

### **Estrutura**

**useSortable Hook**:
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: link.id });
```

**Container**:
```css
background: #151515 (bee-surface)
border-radius: 12px (rounded-xl)
border: 1px solid rgba(255, 255, 255, 0.06)
hover: rgba(255, 60, 110, 0.2)
opacity: link.isActive ? 100% : 50%
isDragging: z-50, shadow-2xl, pink border
```

**Layout** (`flex items-center gap-3 p-4`):

#### **[Col 1] Handle** (GripVertical)
```typescript
<button {...attributes} {...listeners}>
  <GripVertical className="w-5 h-5 text-[#333] hover:text-[#888]" />
</button>
```
- ✅ Cursor: `grab`, active: `grabbing`
- ✅ Transition colors

#### **[Col 2] Info** (`flex-1 min-w-0`)

**Badges** (flex gap-2):
1. **Platform Badge**:
   ```typescript
   <span style={{
     backgroundColor: `${platformColor}26`, // 15% opacity
     color: platformColor,
     border: `1px solid ${platformColor}4D`, // 30% opacity
   }}>
     {platformIcon} {platform}
   </span>
   ```
   - ✅ Rounded-full
   - ✅ Text: 11px font-medium
   - ✅ Dynamic colors per platform

2. **Cloaking Badge** (se `cloakEnabled`):
   ```typescript
   <span className="bg-bee-dim/20 text-bee-dim border-bee-dim/30">
     🔐 Cloaking
   </span>
   ```

**Título**:
```typescript
<div className="font-barlow font-semibold text-sm text-white truncate">
  {link.title}
</div>
```

**URL Mascarada**:
```typescript
<div className="text-[11px] text-bee-dim truncate">
  beesocial.app/r/{link.shortCode}
</div>
```

#### **[Col 3] Stats**
```typescript
<div className="text-xs text-bee-muted text-right min-w-[60px]">
  {link.clicks.toLocaleString()} clicks
</div>
```

#### **[Col 4] Toggle**
```typescript
<Switch
  checked={link.isActive}
  onCheckedChange={(checked) => onToggleActive(link.id, checked)}
/>
```
- ✅ shadcn Switch component
- ✅ Toast ao mudar: "Link ativado!" / "Link desativado!"

#### **[Col 5] Ações** (flex gap-2)

**Botões**:
1. **Editar** (Pencil icon):
   ```typescript
   onClick={() => onEdit(link)}
   ```
   - Abre modal com dados do link

2. **Copiar** (Copy icon):
   ```typescript
   onClick={() => {
     navigator.clipboard.writeText(`https://beesocial.app/r/${link.shortCode}`);
     toast.success("Link copiado!");
   }}
   ```

3. **Deletar** (Trash2 icon):
   ```typescript
   onClick={() => {
     if (window.confirm("Deletar este link?")) {
       onDelete(link.id);
       toast.success("Link deletado!");
     }
   }}
   ```
   - ✅ Color: muted, hover: red-500

**Estilo dos botões de ação**:
```css
padding: 6px (p-1.5)
color: bee-muted
hover: white (ou red para delete)
transition: colors
border-radius: 4px (rounded)
```

---

## 🪟 **LinkModal Component (`components/dashboard/LinkModal.tsx`)**

### **Dialog shadcn**

**Container**:
```typescript
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-md bg-bee-surface border-bee-border">
    {/* ... */}
  </DialogContent>
</Dialog>
```

### **Header**

**Título**:
```typescript
<DialogTitle className="font-bebas text-2xl uppercase tracking-wide">
  {editLink ? "EDITAR LINK" : "ADICIONAR LINK"}
</DialogTitle>
```

### **PASSO 1 — Escolher Plataforma**

**Label**: "Plataforma" (text-sm font-medium)

**Grid 5 colunas**:
```typescript
<div className="grid grid-cols-5 gap-2">
  {PLATFORMS.map(platform => (
    <button
      onClick={() => handleSelectPlatform(platform.id)}
      style={{
        backgroundColor: selected ? "rgba(255, 60, 110, 0.08)" : "#151515",
        border: selected ? "2px solid #FF3C6E" : "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: selected ? "0 0 10px rgba(255, 60, 110, 0.3)" : "none",
      }}
    >
      <span className="text-xl">{platform.icon}</span>
      <span className="text-[10px] text-bee-muted">
        {platform.label.split(" ")[0]}
      </span>
    </button>
  ))}
</div>
```

**Estados**:
- ✅ Normal: bg `#151515`, border `rgba(255,255,255,0.06)`
- ✅ Hover: border `rgba(255, 60, 110, 0.3)`
- ✅ Selecionado: border `2px solid #FF3C6E`, bg pink/8, `glow-pink-sm`

**Auto-sugestão de título**:
```typescript
const handleSelectPlatform = (platformId: string) => {
  setSelectedPlatform(platformId);
  const platform = PLATFORMS.find(p => p.id === platformId);
  if (platform && !editLink) {
    setTitle(`Meu ${platform.label}`);
  }
};
```

### **PASSO 2 — Preencher Dados** (aparece após selecionar)

#### **1. Título do link**
```typescript
<Input
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  placeholder="Ex: Meu OnlyFans"
  className="bg-bee-bg border-bee-border text-white"
/>
```

#### **2. URL de Destino**

**Label**: "🔒 URL real (nunca exibida publicamente)"

**Input**:
```typescript
<Input
  value={destinationUrl}
  onChange={(e) => setDestinationUrl(e.target.value)}
  placeholder="https://..."
  className="bg-bee-bg border-bee-border text-white"
/>
```

**Helper text**:
```
"Seus seguidores veem apenas /r/código. Sua URL fica protegida."
```
- ✅ Text: 11px
- ✅ Color: bee-muted

#### **3. Toggle Cloaking**

**Layout** (`flex items-start gap-3`):
```typescript
<Switch checked={cloakEnabled} onCheckedChange={setCloakEnabled} />
<div>
  <div className="text-sm font-medium text-white">
    Forçar saída do Instagram (Cloaking)
  </div>
  <p className="text-[11px] text-bee-muted">
    Redireciona para o browser nativo ao acessar pelo Instagram
  </p>
</div>
```

#### **4. Toggle Ativo**

```typescript
<Switch checked={isActive} onCheckedChange={setIsActive} />
<div className="text-sm font-medium text-white">
  Link ativo
</div>
```

### **Footer (DialogFooter)**

**Botões**:
```typescript
<Button variant="ghost" onClick={onClose}>
  Cancelar
</Button>
<Button
  onClick={handleSave}
  className="bg-bee-pink hover:bg-bee-pink-hot rounded-full font-barlow font-bold uppercase glow-pink-sm"
>
  SALVAR LINK
</Button>
```

### **Lógica de Salvamento**

```typescript
const handleSave = () => {
  if (!selectedPlatform || !title.trim()) {
    toast.error("Selecione uma plataforma e preencha o título");
    return;
  }

  const linkData: Partial<Link> = {
    ...(editLink?.id && { id: editLink.id }),
    title: title.trim(),
    platform: selectedPlatform,
    destinationUrl: destinationUrl.trim(),
    shortCode: editLink?.shortCode || generateShortCode(),
    cloakEnabled,
    isActive,
    clicks: editLink?.clicks || 0,
    position: editLink?.position ?? 0,
  };

  onSave(linkData);
  toast.success("Link salvo! ✓");
  onClose();
};
```

**Reset no open/close**:
```typescript
useEffect(() => {
  if (open && editLink) {
    // Preencher com dados do link
    setSelectedPlatform(editLink.platform);
    setTitle(editLink.title);
    // ...
  } else if (open && !editLink) {
    // Limpar form
    setSelectedPlatform(null);
    setTitle("");
    // ...
  }
}, [open, editLink]);
```

---

## 🗂️ **Interface Link Atualizada**

```typescript
export interface Link {
  id: string;
  title: string;
  platform: string;
  shortCode: string;
  destinationUrl?: string;  // ✅ Novo campo
  isActive: boolean;
  position: number;
  clicks: number;
  cloakEnabled: boolean;
}
```

**MOCK_LINKS atualizado** com URLs:
```typescript
{
  id: "l1",
  title: "Meu OnlyFans 🔥",
  platform: "onlyfans",
  shortCode: "xK9mP1",
  destinationUrl: "https://onlyfans.com/bella",
  isActive: true,
  position: 0,
  clicks: 1842,
  cloakEnabled: true,
}
```

---

## 🍞 **Toast Notifications (Sonner)**

**Instalado**: `import { toast, Toaster } from "sonner"`

**Toaster Component**:
```typescript
<Toaster position="top-center" richColors />
```

**Toast Messages**:
- ✅ "Link copiado!" → Ao copiar link do perfil ou de um card
- ✅ "Ordem atualizada!" → Após drag and drop
- ✅ "Link ativado!" / "Link desativado!" → Ao toggle switch
- ✅ "Link salvo! ✓" → Ao salvar no modal
- ✅ "Link deletado!" → Ao deletar link
- ✅ "Selecione uma plataforma e preencha o título" → Erro de validação (toast.error)

---

## ✅ **Funcionalidades Implementadas**

### **Drag and Drop**:
- ✅ Arraste vertical com `@dnd-kit`
- ✅ Handle visual (GripVertical icon)
- ✅ Cursor `grab` / `grabbing`
- ✅ Feedback visual ao arrastar (z-50, shadow, pink border)
- ✅ Atualização automática de `position`
- ✅ Toast de confirmação

### **CRUD de Links**:
- ✅ **Create**: Modal → selecionar plataforma → preencher → salvar
- ✅ **Read**: Lista ordenada por position
- ✅ **Update**: Clicar em Pencil → modal com dados preenchidos → editar → salvar
- ✅ **Delete**: Clicar em Trash → confirm dialog → deletar do estado

### **Toggle Ativo/Inativo**:
- ✅ Switch do shadcn
- ✅ Visual: card com opacity-50 se inativo
- ✅ Toast ao mudar estado

### **Copiar Links**:
- ✅ Botão do perfil (header) → copia `https://beesocial.app/bella`
- ✅ Botão Copy do card → copia `https://beesocial.app/r/{shortCode}`
- ✅ Toast "Link copiado!"

### **Modal Adicionar/Editar**:
- ✅ Grid de plataformas com seleção visual
- ✅ Auto-sugestão de título baseado na plataforma
- ✅ Validação (plataforma + título obrigatórios)
- ✅ Helper texts educativos
- ✅ Toggles para cloaking e ativo
- ✅ Reset ao abrir/fechar
- ✅ Modo edição detecta link existente

### **Estado Vazio**:
- ✅ Card centralizado com ícone
- ✅ Mensagem amigável
- ✅ CTA para adicionar primeiro link

### **Visual & UX**:
- ✅ Badges de plataforma com cores dinâmicas
- ✅ Badge de cloaking
- ✅ Stats de clicks formatados (ex: 1,842)
- ✅ Hover states em todos os botões
- ✅ Transições suaves
- ✅ Feedback de loading durante drag
- ✅ Confirm dialog para deletar
- ✅ Toasts para todas as ações

---

## 🚀 **Status Final**

**PROMPT 7 completamente implementado!**

- ✅ Página de links com header
- ✅ Drag and drop funcional (@dnd-kit)
- ✅ LinkCard com 5 colunas (handle, info, stats, toggle, ações)
- ✅ LinkModal com 2 passos (plataforma → dados)
- ✅ CRUD completo
- ✅ Estado vazio
- ✅ Toast notifications
- ✅ Validações
- ✅ Zero erros linting
- ✅ Visual conforme spec

**Próximo**: PROMPT 8 (Aparência & Temas) ou PROMPT 9 (Analytics)! 🚀
