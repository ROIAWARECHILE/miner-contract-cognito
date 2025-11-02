# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD)
## ContractOS - Administrador Inteligente de Contratos Mineros

**Versión:** 1.0  
**Fecha:** Noviembre 2025  
**Producto:** Sistema de gestión inteligente de contratos con IA

---

## 🎯 VISIÓN DEL PRODUCTO

ContractOS es un sistema inteligente que crea un "gemelo digital" de cada contrato minero, interpretando automáticamente documentos PDF (contratos, EDPs, SDIs, planes) y manteniendo un contexto actualizado del estado contractual en tiempo real.

**Inspiración de diseño:** Magnar.ai, Docusign, Airtable, Notion AI

---

## 🚀 PROPUESTA DE VALOR

### Problema
Las empresas mineras gestionan decenas de contratos complejos con:
- Múltiples documentos anexos (EDPs, SDIs, planes técnicos)
- Fechas críticas de SLA (Rev.0 = 7 días hábiles, SDI = 5 días)
- Seguimiento manual de pagos y avances
- Riesgo de pérdida de información contextual
- Falta de visibilidad del estado real del contrato

### Solución
Sistema que automatiza:
- **Extracción inteligente de datos** de PDFs con IA
- **Gemelo digital contextual** que evoluciona con cada documento
- **Alertas automáticas** de SLA próximos a vencer
- **Visualizaciones** de progreso (curva S, barras, KPIs)
- **Búsqueda semántica** en toda la documentación

---

## 👥 USUARIOS OBJETIVO

### Primarios
1. **Gerentes de Contratos** - Supervisión y toma de decisiones
2. **Analistas Legales** - Revisión de cláusulas y compliance
3. **Administradores de Proyecto** - Seguimiento operativo

### Secundarios
4. **Gerencia Ejecutiva** - Reportes y KPIs estratégicos
5. **Equipo Financiero** - Control de pagos y presupuestos

---

## ⚡ FEATURES MVP (Versión 1.0)

### 1. 📊 Dashboard de Contratos
**Prioridad:** P0 (Crítico)

**Funcionalidad:**
- Vista de todos los contratos activos
- Cards con información clave: código, cliente, estado, progreso
- KPIs agregados: contratos activos, progreso promedio, alertas pendientes, EDPs aprobados
- Búsqueda y filtros inteligentes
- Indicadores visuales de salud del contrato

**Métricas de éxito:**
- Tiempo de localización de contrato < 5 segundos
- 100% de contratos visibles en una pantalla

---

### 2. 🔬 Gemelo Digital del Contrato
**Prioridad:** P0 (Crítico)

**Funcionalidad:**
- Vista detallada del contrato individual
- Timeline de documentos y eventos
- Progreso visual (Curva S, barras de progreso)
- Estados de pago (EDPs) con avance porcentual
- Alertas SLA contextuales
- Desglose financiero (presupuesto vs gastado)

**Componentes clave:**
- **Header del contrato**: Código, título, partes, fechas
- **Stats cards**: Presupuesto total, gastado, disponible, EDPs pagados
- **Curva S**: Comparación planificado vs real
- **Desglose de tareas**: 10 tareas con barras de progreso
- **Equipo**: Miembros del equipo con roles

**Métricas de éxito:**
- Actualización en tiempo real de progreso
- Precisión de curva S vs datos reales > 95%

---

### 3. 📄 Gestión de Documentos
**Prioridad:** P1 (Alta)

**Funcionalidad:**
- Upload de PDFs con drag & drop
- Clasificación automática de tipo de documento (IA)
- Extracción de datos clave con IA:
  - **Contratos:** Código, partes, fechas, montos
  - **EDPs:** Número, período, monto UF, tareas ejecutadas
  - **SDIs:** Ítems, especificaciones, deadlines
  - **Planes:** Objetivos, entregables, cronograma
- Vista previa y navegación de documentos
- Almacenamiento en Supabase Storage
- Versioning automático

**Extracción de datos (IA):**
```json
{
  "document_type": "edp",
  "edp_number": 1,
  "period": "Jul-25",
  "amount_uf": 209.81,
  "uf_rate": 39179.01,
  "amount_clp": 8219991,
  "tasks_executed": [
    {
      "task_number": "1.1",
      "name": "Recopilación y análisis",
      "budget": 507,
      "spent": 147.85,
      "progress": 29
    }
  ]
}
```

**Métricas de éxito:**
- Tiempo de upload < 10 segundos
- Precisión de extracción de datos > 90%
- Clasificación correcta de tipo de documento > 95%

---

### 4. 🔔 Alertas y Notificaciones SLA
**Prioridad:** P0 (Crítico)

**Funcionalidad:**
- Alertas de SLA próximos a vencer
- **Rev.0:** 7 días hábiles (amarillo a 3 días, rojo < 1 día)
- **SDI:** 5 días hábiles (amarillo a 2 días, rojo < 1 día)
- Notificaciones push en el dashboard
- Badge de contador en el header
- Panel de alertas con priorización

**Estados de alerta:**
- `active`: > 3 días restantes (verde)
- `warning`: 1-3 días restantes (amarillo)
- `overdue`: Plazo vencido (rojo)
- `resolved`: Entregado a tiempo
- `dismissed`: Usuario descartó

**Métricas de éxito:**
- 0% de SLA vencidos sin alerta previa
- Tiempo de reacción a alerta crítica < 1 hora

---

### 5. 📈 Reportes Visuales
**Prioridad:** P1 (Alta)

**Funcionalidad:**
- **Curva S:** Progreso acumulado planificado vs real
- **Barras de avance:** Por tarea individual
- **Indicadores KPI:**
  - UF gastado vs presupuesto
  - % de avance real vs planificado
  - Velocidad de ejecución (UF/mes)
  - Proyección de finalización
- **Gráficos de estado:**
  - EDPs pagados vs pendientes
  - Tareas completadas vs en progreso
  - Distribución de horas por especialista

**Tecnología:**
- Recharts para visualizaciones
- Exportación a PDF (futuro)
- Dashboard configurable por usuario (futuro)

**Métricas de éxito:**
- Tiempo de carga de dashboards < 2 segundos
- 100% de datos visualizados en tiempo real

---

## 🏗️ ARQUITECTURA TÉCNICA

### Frontend
```
React 18 + TypeScript
├── TailwindCSS (diseño responsivo)
├── Shadcn/ui (componentes)
├── Recharts (visualizaciones)
├── React Query (data fetching)
└── React Router (navegación)
```

### Backend
```
Supabase
├── PostgreSQL (base de datos)
├── Row Level Security (RLS)
├── Supabase Storage (PDFs)
├── Edge Functions (procesamiento)
└── Realtime (updates en vivo)
```

### IA y Procesamiento
```
Lovable AI Gateway
├── Gemini 2.5 Pro (extracción de datos)
├── Document parsing (PDFs)
├── Clasificación de documentos
├── Extracción de entidades
└── Generación de resúmenes
```

---

## 📊 MODELO DE DATOS

### Tablas Principales

1. **contracts** - Contrato principal
   - Información básica (código, título, descripción)
   - Partes (cliente, contratista)
   - Financiero (presupuesto, gastado)
   - Estado y progreso
   - Fechas clave

2. **contract_documents** - Documentos vinculados
   - Tipo de documento (EDP, SDI, plan, etc.)
   - Archivo y metadatos
   - Estado de procesamiento IA
   - Datos extraídos (JSONB)

3. **payment_states** - Estados de pago (EDPs)
   - Número de EDP
   - Montos (UF y CLP)
   - Estado de aprobación
   - Fechas de pago

4. **contract_tasks** - Tareas del contrato
   - Nombre y descripción
   - Presupuesto y gastado
   - Progreso %
   - Horas planificadas vs reales

5. **sla_alerts** - Alertas de SLA
   - Tipo de alerta (Rev.0, SDI, etc.)
   - Días límite
   - Estado (activo, vencido, resuelto)
   - Prioridad

6. **team_members** - Equipo del contrato
   - Nombre y rol
   - Especialidad
   - Contacto

7. **activity_log** - Log de actividades
   - Tipo de actividad
   - Usuario
   - Timestamp
   - Metadatos

---

## 🎨 DISEÑO E INTERFAZ

### Sistema de Diseño

**Paleta de colores:**
- **Primary:** Azul corporativo profundo (HSL 217 91% 35%)
- **Accent:** Cobre/naranja minero (HSL 25 95% 53%)
- **Success:** Verde aprobación (HSL 142 76% 36%)
- **Warning:** Amarillo alerta (HSL 38 92% 50%)
- **Destructive:** Rojo crítico (HSL 0 84% 60%)

**Tipografía:**
- **Fuente principal:** Inter (limpia, profesional)
- **Fuente monospace:** Para códigos de contrato

**Componentes:**
- Todos con diseño system tokens (NO colores directos)
- Sombras y glows sutiles para profundidad
- Animaciones smooth (cubic-bezier timing)
- Hover states con spring transitions
- Border radius consistente (0.75rem)

**Gradientes:**
```css
--gradient-primary: linear-gradient(135deg, primary, primary-glow)
--gradient-accent: linear-gradient(135deg, accent, accent-glow)
```

---

## 🔒 SEGURIDAD Y PERMISOS

### Row Level Security (RLS)
- Todos los usuarios autenticados pueden leer contratos
- Usuarios autenticados pueden crear/editar (MVP simplificado)
- Futuro: Roles diferenciados (admin, legal, viewer)

### Gestión de archivos
- PDFs almacenados en Supabase Storage
- Bucket público para documentos (configurar policies en producción)
- Checksums para verificar integridad

---

## 📱 EXPERIENCIA DE USUARIO

### Flujo Principal

1. **Login** → Dashboard de contratos
2. **Seleccionar contrato** → Vista de gemelo digital
3. **Ver progreso** → Curva S y tareas
4. **Revisar alertas** → Panel de SLA
5. **Cargar documento** → Upload → Procesamiento IA → Actualización automática

### Tiempos de Respuesta Esperados
- Carga inicial: < 2 segundos
- Navegación entre vistas: < 500ms
- Upload de documento: < 10 segundos
- Procesamiento IA: < 30 segundos (background)
- Actualización de progreso: Tiempo real

---

## 🚢 ROADMAP DE DESARROLLO

### Fase 1: MVP (4 semanas) ✅
- [x] Diseño del sistema
- [x] Esquema de base de datos
- [x] Dashboard principal
- [x] Vista de contrato detallada
- [x] Visualizaciones básicas (Curva S)
- [ ] Upload de documentos
- [ ] Extracción IA básica
- [ ] Sistema de alertas SLA

### Fase 2: IA Avanzada (3 semanas)
- [ ] Clasificación automática de documentos
- [ ] Extracción de entidades complejas
- [ ] Búsqueda semántica con embeddings
- [ ] Chat contextual con el contrato
- [ ] Generación de resúmenes

### Fase 3: Colaboración (2 semanas)
- [ ] Sistema de comentarios
- [ ] Notificaciones por email
- [ ] Workflow de aprobaciones
- [ ] Gestión de roles avanzada

### Fase 4: Analytics (2 semanas)
- [ ] Reportes personalizados
- [ ] Exportación a PDF/Excel
- [ ] Predicciones de finalización
- [ ] Benchmarking entre contratos

---

## 📊 MÉTRICAS DE ÉXITO

### Métricas de Adopción
- MAU (Monthly Active Users) > 50 en primer trimestre
- Contratos gestionados > 20 en 3 meses
- Documentos procesados > 200 en 3 meses

### Métricas de Eficiencia
- Reducción de tiempo de búsqueda: 80%
- Reducción de SLA vencidos: 90%
- Precisión de datos extraídos: > 90%
- Tiempo de onboarding de nuevo usuario: < 15 minutos

### Métricas de Satisfacción
- NPS (Net Promoter Score) > 50
- Tiempo de respuesta del sistema < 2 segundos
- Uptime del servicio > 99.5%

---

## 🔧 STACK TECNOLÓGICO COMPLETO

### Frontend
- **Framework:** React 18.3+
- **Language:** TypeScript 5+
- **Styling:** TailwindCSS 3.4+
- **UI Components:** Shadcn/ui
- **Charts:** Recharts 2.15+
- **State:** React Query (TanStack Query)
- **Routing:** React Router DOM 6+
- **Forms:** React Hook Form + Zod

### Backend
- **Database:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Functions:** Supabase Edge Functions (Deno)
- **Realtime:** Supabase Realtime subscriptions

### IA y ML
- **LLM Gateway:** Lovable AI Gateway
- **Model:** Gemini 2.5 Pro (google/gemini-2.5-pro)
- **Document Processing:** PDF parsing + OCR
- **Embeddings:** Para búsqueda semántica (futuro)

### DevOps
- **Hosting:** Lovable Cloud
- **CI/CD:** GitHub Actions (futuro)
- **Monitoring:** Supabase Analytics
- **Logs:** Edge Function Logs

---

## 🎓 GLOSARIO

- **EDP:** Estado de Pago - Documento mensual de avance y facturación
- **SDI:** Solicitud de Información - Requerimiento técnico con deadline de 5 días
- **Rev.0:** Primera revisión de un documento - Deadline de 7 días hábiles
- **UF:** Unidad de Fomento - Unidad de cuenta chilena indexada a inflación
- **Gemelo Digital:** Representación virtual actualizada del contrato
- **SLA:** Service Level Agreement - Plazo contractual comprometido
- **Curva S:** Gráfico de progreso acumulado típico de proyectos

---

## 📞 CONTACTO Y SOPORTE

**Equipo de Producto:**
- Product Manager: [TBD]
- Tech Lead: [TBD]
- UX Designer: [TBD]

**Enlaces útiles:**
- Documentación: [TBD]
- Soporte: support@contractos.cl
- GitHub: [TBD]

---

**Última actualización:** Noviembre 2, 2025  
**Próxima revisión:** Diciembre 1, 2025
