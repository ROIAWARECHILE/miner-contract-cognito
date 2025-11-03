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
          <h3 className="font-semibold text-foreground mb-2">
            ℹ️ Proceso automático de ingesta
          </h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Los documentos se suben al bucket <code className="bg-muted px-1 rounded">contracts/dominga/</code></p>
            <p>• Se procesan inmediatamente con IA (Gemini 2.5 Pro)</p>
            <p>• La extracción incluye clasificación, parseo, validación y cálculo de KPIs</p>
            <p>• Los resultados se actualizan en tiempo real en el dashboard</p>
            <p>• El procesamiento ocurre en segundo plano sin esperas</p>
          </div>
        </div>
      </main>
    </div>
  );
}
