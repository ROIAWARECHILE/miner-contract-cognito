import { useState } from 'react';
import DocumentUploader from '@/components/DocumentUploader';
import { DocumentProcessingMonitor } from '@/components/DocumentProcessingMonitor';
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
            <DocumentProcessingMonitor contractId={selectedContractId} />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Section 1: Payment States (EDPs) */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Estados de Pago (EDP)
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Sube los PDFs de estados de pago mensuales
              </p>
              <DocumentUploader defaultType="edp" preselectedContractId={selectedContractId} />
            </div>
          </section>

          {/* Section 2: Memorandums */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Memorándums Técnicos
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Sube memorándums de respaldo de EDPs con curvas S
              </p>
              <DocumentUploader defaultType="memorandum" preselectedContractId={selectedContractId} />
            </div>
          </section>
        </div>

        {/* Info Banner */}
        <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-xl">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-primary">📊</span>
            Sistema de Procesamiento de EDPs y Memorandums
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary px-2 py-1 rounded font-medium text-xs">EDP</div>
              <div>
                <strong className="text-foreground">Estados de Pago:</strong> Extracción automática de montos UF/CLP, tareas ejecutadas, porcentajes de avance por partida
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary px-2 py-1 rounded font-medium text-xs">MEMO</div>
              <div>
                <strong className="text-foreground">Memorándums:</strong> Análisis de curvas S (Plan vs Real), actividades realizadas, figuras y anexos técnicos
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground">
              <strong className="text-primary">🤖 IA:</strong> Procesamiento inteligente con OpenAI GPT-4o para máxima precisión en extracción de datos numéricos y curvas
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
