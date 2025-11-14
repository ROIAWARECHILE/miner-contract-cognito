# 🏛️ Arquitectura de ContractOS

Este documento describe la arquitectura de alto nivel, el flujo de datos y los componentes clave del sistema ContractOS.

## 🖼️ Big Picture: La Arquitectura General

ContractOS está construido sobre una arquitectura moderna de aplicación web de página única (SPA) con un backend "serverless" desacoplado, aprovechando los servicios gestionados de Supabase y modelos de IA de vanguardia.

```mermaid
graph TD
    subgraph Frontend (React + Vite)
        A[Interfaz de Usuario] --> B{React Query};
        B --> C[Cliente Supabase];
    end

    subgraph Backend (Supabase)
        C -- CRUD --> D[PostgreSQL Database];
        C -- Almacenamiento --> E[Supabase Storage];
        C -- Invocación --> F[Edge Functions];
        D -- Notificaciones en Tiempo Real --> B;
    end

    subgraph Servicios de IA
        G[LlamaParse] -- PDF a JSON --> F;
        H[OpenAI GPT-4o] -- Extracción de Datos --> F;
    end

    A -- Carga de Archivos --> E;
    F -- Lectura de Archivos --> E;
    F -- Parseo --> G;
    F -- Extracción --> H;
    F -- Escritura de Datos --> D;

    style Frontend fill:#cde4ff
    style Backend fill:#d5f4d8
    style "Servicios de IA" fill:#ffe4c4
```

### Componentes Principales:

1.  **Frontend:** Una aplicación de React construida con Vite y TypeScript. Se encarga de toda la interfaz de usuario, la visualización de datos y la interacción del usuario. Utiliza `React Query` para una gestión de estado y `data fetching` eficientes y en tiempo real.
2.  **Backend (Supabase):** Un conjunto de servicios que actúan como el backend principal:
    *   **PostgreSQL Database:** El corazón del sistema, donde se almacenan todos los datos relacionales (contratos, documentos, tareas, etc.).
    *   **Supabase Storage:** Almacena de forma segura todos los archivos PDF cargados por los usuarios.
    *   **Edge Functions:** Lógica de negocio serverless escrita en Deno (TypeScript). Son el motor de procesamiento de documentos y la integración con servicios de IA.
3.  **Servicios de IA:**
    *   **LlamaParse:** Un servicio especializado que recibe un archivo PDF y lo convierte en una representación JSON estructurada, identificando texto, tablas y la disposición de los elementos.
    *   **OpenAI (GPT-4o):** Un modelo de lenguaje grande y potente que se utiliza para la extracción de información inteligente. Recibe el JSON de LlamaParse y, guiado por *prompts* específicos, extrae los datos clave en un formato JSON predefinido.

## 🌊 Flujo de Datos: El Viaje de un Documento

El flujo de procesamiento de un documento es el proceso más crítico y representativo de la arquitectura del sistema.

1.  **Carga (Frontend):** Un usuario arrastra y suelta un archivo PDF en el componente `DocumentUploader.tsx`. El archivo se sube directamente a **Supabase Storage**.
2.  **Disparo del Proceso (Frontend -> Backend):** Una vez que la carga es exitosa, el frontend invoca la Edge Function `process-document`, enviando la ruta del archivo en Storage y el tipo de documento.
3.  **Procesamiento (Edge Function):**
    a.  **Descarga Segura:** La función genera una URL firmada para descargar el archivo desde Storage.
    b.  **Parseo con LlamaParse:** El archivo se envía a la API de **LlamaParse**, que lo analiza y devuelve una representación JSON detallada.
    c.  **Extracción con GPT-4o:** El JSON parseado se inserta en un *prompt* específico para el tipo de documento. Este *prompt* se envía a **GPT-4o**, que extrae la información relevante y la devuelve como un objeto JSON limpio.
    d.  **Validación y Enriquecimiento:** La función valida la estructura del JSON recibido, normaliza datos (ej. fechas, números) y realiza comprobaciones de consistencia (ej. la suma de los montos de las tareas de un EDP debe coincidir con el total).
    e.  **Persistencia en Base de Datos:** Los datos extraídos se guardan en las tablas correspondientes de la base de datos PostgreSQL (`documents`, `payment_states`, `contract_summaries`, etc.).
4.  **Visualización en Tiempo Real (Backend -> Frontend):** La base de datos, a través de las suscripciones en tiempo real de Supabase, notifica al frontend de los cambios. `React Query` invalida automáticamente los datos obsoletos y vuelve a obtener la información actualizada, reflejando el progreso y los datos extraídos en la interfaz de usuario casi instantáneamente.

## 🔑 Archivos Clave del Repositorio

Esta es una lista de los archivos más importantes para entender la arquitectura y la lógica de negocio del proyecto.

### Frontend (`src/`)

-   `src/main.tsx`: Punto de entrada de la aplicación React.
-   `src/pages/Index.tsx`: Componente principal que renderiza el dashboard general de contratos. Es un buen punto de partida para entender la estructura de la UI.
-   `src/components/DocumentUploader.tsx`: El componente de React responsable de la interfaz de carga de archivos. Contiene la lógica para subir archivos a Supabase Storage e invocar la Edge Function de procesamiento.
-   `src/components/ContractDashboard.tsx`: Muestra la vista general de todos los contratos, un ejemplo clave de cómo se leen y se presentan los datos desde Supabase.
-   `src/integrations/supabase/client.ts`: Archivo fundamental que inicializa y exporta el cliente de Supabase, permitiendo la comunicación con el backend desde cualquier parte del frontend.

### Backend (`supabase/`)

-   `supabase/config.toml`: Archivo de configuración principal para el proyecto de Supabase, donde se definen las funciones y otras configuraciones.
-   `supabase/migrations/`: Contiene las migraciones SQL que definen el esquema completo de la base de datos. Es la "fuente de la verdad" para la estructura de datos.
-   **`supabase/functions/process-document/index.ts`**: **El archivo más importante del backend.** Contiene toda la lógica de orquestación para el procesamiento de documentos: descarga, parseo con LlamaParse, extracción con OpenAI, validación y almacenamiento en la base de datos. Los *prompts* de IA detallados que se encuentran aquí son el "cerebro" del sistema de extracción.
-   `supabase/functions/contract-assistant/index.ts`: (Futuro o en desarrollo) Probablemente contendrá la lógica para la funcionalidad de chat contextual con los contratos.

### Documentación

-   `README.md`: Visión general del proyecto, stack tecnológico y cómo empezar.
-   `PRD.md`: El Documento de Requisitos del Producto. Esencial para entender el "por qué" detrás de las características y la visión a largo plazo del proyecto.