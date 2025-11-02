# 🏗️ ContractOS - Administrador Inteligente de Contratos Mineros

Sistema inteligente de gestión de contratos mineros con IA que crea un "gemelo digital" de cada contrato, automatizando la extracción de datos de documentos PDF, seguimiento de pagos, y alertas de SLA.

![ContractOS Dashboard](src/assets/hero-dashboard.jpg)

## ✨ Características Principales

- 📊 **Dashboard Inteligente** - Vista completa de todos los contratos con KPIs en tiempo real
- 🔬 **Gemelo Digital** - Contexto actualizado de cada contrato que evoluciona con cada documento
- 📄 **Gestión de Documentos** - Upload, clasificación y extracción automática de datos con IA
- 🔔 **Alertas SLA** - Notificaciones automáticas de plazos críticos (Rev.0: 7 días, SDI: 5 días)
- 📈 **Visualizaciones** - Curva S, barras de progreso, KPIs financieros
- 🔍 **Búsqueda Semántica** - Encuentra información en toda la documentación contractual

## 🚀 Stack Tecnológico

### Frontend
- **React 18** + TypeScript
- **TailwindCSS** con diseño profesional
- **Shadcn/ui** componentes
- **Recharts** para visualizaciones
- **React Query** para data fetching

### Backend
- **Supabase** (PostgreSQL + Auth + Storage)
- **Edge Functions** para procesamiento
- **Lovable AI** (Gemini 2.5 Pro) para extracción de datos

## 📋 Documentación

- [Product Requirements Document (PRD)](./PRD.md) - Especificaciones completas del producto
- [Database Schema](./docs/schema.md) - Estructura de la base de datos

## 🏃‍♂️ Inicio Rápido

### Requisitos
- Node.js 18+ & npm
- Cuenta de Supabase (ya configurada)

### Instalación

```bash
# Clonar el repositorio
git clone <YOUR_GIT_URL>

# Navegar al directorio
cd miner-contract-cognito

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El app estará disponible en `http://localhost:8080`

## 🗄️ Estructura del Proyecto

```
src/
├── assets/          # Imágenes y recursos
├── components/      # Componentes React
│   ├── ui/         # Shadcn componentes base
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── ContractDashboard.tsx
│   └── ContractDetail.tsx
├── hooks/          # Custom React hooks
│   └── useContract.ts
├── integrations/   # Integraciones externas
│   └── supabase/   # Cliente Supabase
├── lib/            # Utilidades
├── pages/          # Páginas principales
│   └── Index.tsx
└── index.css       # Estilos globales y design system
```

## 🎨 Sistema de Diseño

Todos los estilos están definidos en el design system (`index.css` y `tailwind.config.ts`):

**Colores principales:**
- `primary` - Azul corporativo profundo
- `accent` - Cobre/naranja minero
- `success` - Verde aprobación
- `warning` - Amarillo alerta
- `destructive` - Rojo crítico

**NO usar colores directos** como `text-white`, `bg-blue-500`. Siempre usar tokens semánticos del design system.

## 📊 Modelo de Datos

### Tablas Principales

**contracts** - Contrato principal
```sql
- code (único): AIPD-CSI001-1000-MN-0001
- title, description
- client_name, contractor_name
- budget_uf, spent_uf
- status, progress_percentage
- start_date, end_date
```

**contract_documents** - Documentos vinculados
```sql
- document_type: main_contract, edp, sdi, technical_plan
- file_url (Supabase Storage)
- ai_extracted_data (JSONB)
- ai_processing_status
```

**payment_states** - Estados de Pago (EDPs)
```sql
- edp_number
- amount_uf, amount_clp
- status: draft, submitted, approved, paid
```

**contract_tasks** - Tareas del contrato
```sql
- task_name
- budget_uf, spent_uf
- progress_percentage
```

**sla_alerts** - Alertas de SLA
```sql
- alert_type: revision_0, sdi, edp_deadline
- business_days_limit: 7 for Rev.0, 5 for SDI
- status: active, warning, overdue
```

**team_members** - Equipo del proyecto
```sql
- full_name, role, specialty
- email, phone
```

## 🔒 Seguridad

- **Row Level Security (RLS)** habilitado en todas las tablas
- Usuarios autenticados pueden leer todos los contratos
- Permisos granulares por rol (futuro)
- Documentos en Supabase Storage con policies

## 🚢 Despliegue

### Lovable Cloud (Recomendado)
```bash
# Hacer commit de cambios
git add .
git commit -m "Update contract system"
git push

# El despliegue es automático en Lovable
```

### Manual
```bash
# Build para producción
npm run build

# El output estará en dist/
```

## 🧪 Testing

```bash
# Run tests (futuro)
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## 📚 Recursos Útiles

- [Supabase Documentation](https://supabase.com/docs)
- [React Query](https://tanstack.com/query/latest)
- [Shadcn/ui Components](https://ui.shadcn.com/)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Lovable Documentation](https://docs.lovable.dev/)

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

## 👥 Equipo

Desarrollado con ❤️ para la industria minera chilena.

---

**Versión:** 1.0  
**Última actualización:** Noviembre 2, 2025
