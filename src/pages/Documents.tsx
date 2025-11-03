import { useState } from 'react';
import DocumentUploader from '@/components/DocumentUploader';
import IngestJobMonitor from '@/components/IngestJobMonitor';
import { Header } from '@/components/Header';
import { useContracts } from '@/hooks/useContract';
import { Card } from '@/components/ui/card';

export default function DocumentsPage() {
  const { data: contracts } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState<string>('');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestión de Documentos
          </h1>
          <p className="text-muted-foreground">
            Sube y procesa documentos del proyecto Dominga automáticamente
          </p>
        </div>

        {/* Global Contract Selector */}
        <Card className="p-6 mb-6">
          <label className="block mb-2 text-sm font-medium text-foreground">
            Seleccionar Contrato
          </label>
          <select 
            className="w-full max-w-2xl rounded-lg border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
            value={selectedContractId} 
            onChange={e => setSelectedContractId(e.target.value)}
          >
            <option value="">Seleccionar contrato...</option>
            {contracts?.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
          {selectedContractId && (
            <p className="mt-2 text-xs text-muted-foreground">
              ✓ Todos los documentos se asociarán a este contrato
            </p>
          )}
        </Card>

        {/* Job Monitor */}
        {selectedContractId && (
          <div className="mb-6">
            <IngestJobMonitor contractId={selectedContractId} />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Section 1: Contract & Technical Bases */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Contrato & Bases Técnicas
              </h2>
              <div className="space-y-3">
                <DocumentUploader defaultType="contract" preselectedContractId={selectedContractId} />
                <DocumentUploader defaultType="quality" preselectedContractId={selectedContractId} />
                <DocumentUploader defaultType="sso" preselectedContractId={selectedContractId} />
                <DocumentUploader defaultType="tech" preselectedContractId={selectedContractId} />
              </div>
            </div>
          </section>

          {/* Section 2: Payment States (EDPs) */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Estados de Pago (EDP)
              </h2>
              <DocumentUploader defaultType="edp" preselectedContractId={selectedContractId} />
            </div>
          </section>

          {/* Section 3: Administrative */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Administrativo
              </h2>
              <div className="space-y-3">
                <DocumentUploader defaultType="sdi" preselectedContractId={selectedContractId} />
                <DocumentUploader defaultType="addendum" preselectedContractId={selectedContractId} />
              </div>
            </div>
          </section>
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-3">
            🤖 Procesamiento Inteligente Multi-Capa
          </h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-green-600 dark:text-green-400">Capa 1 - LlamaParse:</span>
              <span>Extrae estructura, tablas y contenido del PDF en formato Markdown</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Capa 2 - Gemini/Claude:</span>
              <span>Analiza el contenido y genera JSON estructurado con validaciones</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-purple-600 dark:text-purple-400">Capa 3 - Validación:</span>
              <span>Verifica cifras, cálculos y consistencia de datos automáticamente</span>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                ⚠️ Configuración Importante
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                Verifica tu API key de LlamaParse en{' '}
                <a 
                  href="https://cloud.llamaindex.ai/api-key" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  cloud.llamaindex.ai
                </a>
                {' '}(debe tener formato llx-...). Sin una key válida, el sistema usará Claude 3.5 Sonnet como fallback.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
