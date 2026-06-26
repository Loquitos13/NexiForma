# 🚀 Quick Start – Implementação Páginas CRM

> **Tempo estimado**: 3-4 horas  
> **Dificuldade**: Fácil-Média  
> **Pré-requisitos**: Components já criados ✅

---

## 📑 Estrutura Páginas

```
apps/web/app/plataforma/
├── crm/
│   ├── layout.tsx              # Layout CRM (sidebar navigation)
│   ├── page.tsx                # Dashboard CRM
│   ├── entidades/
│   │   ├── page.tsx            # Lista entidades
│   │   ├── nova/page.tsx       # Criar entidade
│   │   └── [id]/page.tsx       # Detalhe entidade
│   ├── propostas/
│   │   ├── page.tsx            # Lista propostas
│   │   ├── nova/page.tsx       # Criar proposta
│   │   └── [id]/page.tsx       # Detalhe proposta
│   └── formadores/
│       ├── page.tsx            # Lista formadores
│       └── [id]/page.tsx       # Detalhe formador
├── definicoes/
│   ├── layout.tsx
│   ├── perfil/page.tsx         # User settings
│   └── empresa/page.tsx        # Tenant admin
```

---

## 1️⃣ Layout CRM (`app/plataforma/crm/layout.tsx`)

```typescript
'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const { primaryColor, sidebarCollapsed, setSidebarCollapsed, theme } = useTheme();
  const pathname = usePathname();

  const menuItems = [
    { label: 'Dashboard', href: '/plataforma/crm', icon: '📊' },
    { label: 'Entidades', href: '/plataforma/crm/entidades', icon: '👥' },
    { label: 'Propostas', href: '/plataforma/crm/propostas', icon: '📄' },
    { label: 'Formadores', href: '/plataforma/crm/formadores', icon: '🎓' },
  ];

  const bgSidebar = theme === 'dark' ? '#0f172a' : '#ffffff';
  const bgMain = theme === 'dark' ? '#1e293b' : '#f8fafc';

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`transition-all duration-300 shadow-lg ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
        style={{ backgroundColor: bgSidebar }}
      >
        {/* Header Sidebar */}
        <div className="p-4 flex items-center justify-between border-b">
          {!sidebarCollapsed && (
            <h1 className="font-bold text-lg" style={{ color: primaryColor }}>
              NexiForma
            </h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-200 rounded"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Menu */}
        <nav className="space-y-2 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                pathname.startsWith(item.href)
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={{
                backgroundColor:
                  pathname.startsWith(item.href) ? primaryColor : 'transparent',
              }}
            >
              <span className="text-xl">{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Settings Footer */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link
            href="/plataforma/definicoes/perfil"
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
          >
            <span>⚙️</span>
            {!sidebarCollapsed && <span className="text-sm">Definições</span>}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main
        className="flex-1 overflow-auto"
        style={{ backgroundColor: bgMain }}
      >
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---

## 2️⃣ Dashboard CRM (`app/plataforma/crm/page.tsx`)

```typescript
'use client';

import { CRMDashboard } from '@/components/crm/CRMDashboard';

export default function CRMPage() {
  return <CRMDashboard />;
}
```

---

## 3️⃣ Lista Entidades (`app/plataforma/crm/entidades/page.tsx`)

```typescript
'use client';

import { ListaEntidades } from '@/components/crm/ListaEntidades';

export default function EntidadesPage() {
  return <ListaEntidades />;
}
```

---

## 4️⃣ Criar Entidade (`app/plataforma/crm/entidades/nova/page.tsx`)

```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormEntidade } from '@/components/crm/FormEntidade';
import { useTheme } from '@/contexts/ThemeContext';

export default function NovaEntidadePage() {
  const { primaryColor } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/entidades', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/plataforma/crm/entidades');
      } else {
        alert('Erro ao criar entidade');
      }
    } catch (error) {
      alert('Erro: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
          Nova Entidade
        </h1>
        <p className="text-gray-500 mt-2">Registre uma nova empresa cliente</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <FormEntidade onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
```

---

## 5️⃣ User Settings (`app/plataforma/definicoes/perfil/page.tsx`)

```typescript
'use client';

import { UserSettingsPanel } from '@/components/settings/UserSettingsPanel';

export default function PerfilPage() {
  return (
    <div className="p-6">
      <UserSettingsPanel />
    </div>
  );
}
```

---

## 6️⃣ Tenant Admin (`app/plataforma/definicoes/empresa/page.tsx`)

```typescript
'use client';

import { TenantAdminPanel } from '@/components/settings/TenantAdminPanel';

export default function EmpresaPage() {
  return (
    <div className="p-6">
      <TenantAdminPanel />
    </div>
  );
}
```

---

## 📋 Checklist Implementação

- [ ] Criar `app/plataforma/crm/layout.tsx`
- [ ] Criar `app/plataforma/crm/page.tsx`
- [ ] Criar `app/plataforma/crm/entidades/page.tsx`
- [ ] Criar `app/plataforma/crm/entidades/nova/page.tsx`
- [ ] Criar `app/plataforma/crm/propostas/page.tsx`
- [ ] Criar `app/plataforma/crm/propostas/nova/page.tsx`
- [ ] Criar `app/plataforma/crm/formadores/page.tsx`
- [ ] Criar `app/plataforma/definicoes/perfil/page.tsx`
- [ ] Criar `app/plataforma/definicoes/empresa/page.tsx`
- [ ] Testar navegação e styles
- [ ] Verificar tema light/dark
- [ ] Testar settings persistência

---

## 🧪 Teste Local

```bash
cd NexiForma/apps/web
npm run dev

# Acesso
http://localhost:3000/plataforma/crm
```

---

## 🎨 Customizações Adicionais

### Adicionar mais cores ao UserSettings

```typescript
// No UserSettingsPanel
const cores = [
  '#2563eb',  // Azul
  '#dc2626',  // Vermelho
  '#16a34a',  // Verde
  '#d97706',  // Laranja
  '#7c3aed',  // Roxo
  '#0891b2',  // Ciano
  '#e11d48',  // Rosa
  '#EA580C',  // Laranja escuro
  '#8b5cf6',  // Violeta
  '#ec4899',  // Rosa Fucsia
];
```

### Adicionar Notificações Toast

```typescript
// Criar @/components/ui/Toast.tsx
export const Toast: React.FC<{ message: string; type: 'success' | 'error' }> = ({
  message,
  type,
}) => {
  const color = type === 'success' ? '#10b981' : '#ef4444';
  
  return (
    <div
      className="fixed bottom-4 right-4 p-4 rounded-lg text-white"
      style={{ backgroundColor: color }}
    >
      {message}
    </div>
  );
};
```

---

## 💡 Dicas de Performance

1. **Lazy load componentes pesados** (gráficos)
```typescript
const CRMDashboard = dynamic(() => import('./CRMDashboard'), {
  loading: () => <div>Carregando...</div>,
});
```

2. **Cache de settings**
```typescript
// Guardar em sessionStorage
sessionStorage.setItem('theme', JSON.stringify(paleta));
```

3. **Debounce atualização settings**
```typescript
const debouncedSave = useCallback(
  debounce((settings) => salvarSettings(settings), 1000),
  []
);
```

---

**Status**: Pronto para implementar ✅  
**Tempo total estimado**: 3-4 horas  
**Dificuldade**: Fácil (copy-paste + pequenas adaptações)

